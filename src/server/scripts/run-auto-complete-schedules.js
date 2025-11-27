const db = require('../db/db');
const crypto = require('crypto');

async function detectDateColumn() {
  const r = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='course_arrangement' AND column_name IN ('arr_date','class_date','date')
  `);
  const cols = new Set((r.rows || []).map(x => x.column_name));
  if (cols.has('arr_date')) return 'arr_date';
  if (cols.has('class_date')) return 'class_date';
  if (cols.has('date')) return 'date';
  // 兜底：返回 date，若不存在将导致查询为空
  return 'date';
}

async function withRetry(fn, { retries = 3, delayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      const transient = String(err?.message || '').includes('fetch failed') || String(err?.code || '').includes('ETIMEDOUT');
      if (!transient && i === retries - 1) break;
      await new Promise(res => setTimeout(res, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

async function runAutoComplete() {
  const runId = crypto.randomUUID();
  let updatedCount = 0;
  let batchNo = 0;
  try {
    const dateCol = await detectDateColumn();
    console.log(`[auto-complete] date column = ${dateCol}`);

    while (true) {
      batchNo++;
      // 选取待自动更新的记录（仅 pending/confirmed，日期已过，未自动更新过）
      const pick = await withRetry(() => db.query(
        `SELECT id, status FROM course_arrangement
         WHERE ${dateCol} < CURRENT_DATE
           AND status IN ('pending','confirmed')
           AND last_auto_update IS NULL
         ORDER BY ${dateCol} ASC
         LIMIT 500`
      ));
      const rows = pick.rows || [];
      if (rows.length === 0) break;
      const ids = rows.map(r => r.id);
      const prevStatusById = new Map(rows.map(r => [r.id, String(r.status || 'pending')]));

      // 事务：更新状态并写入日志（幂等保证）
      await withRetry(async () => {
        await db.runInTransaction(async (client, usePool) => {
          const q = usePool ? db.query : client.query.bind(client);
          const upd = await q(
            `UPDATE course_arrangement
               SET status = 'completed', last_auto_update = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ANY($1::int[])
               AND status IN ('pending','confirmed')
               AND last_auto_update IS NULL`,
            [ids]
          );

          // 插入日志
          const values = [];
          let placeholders = [];
          let i = 1;
          for (const id of ids) {
            const prev = prevStatusById.get(id) || 'pending';
            values.push(id, prev, 'completed', runId, 'daily_auto_completion');
            placeholders.push(`($${i}, $${i+1}, $${i+2}, $${i+3}, $${i+4})`);
            i += 5;
          }
          if (values.length) {
            await q(
              `INSERT INTO schedule_auto_update_logs (schedule_id, previous_status, new_status, run_id, note)
               VALUES ${placeholders.join(', ')}`,
              values
            );
          }
          updatedCount += ids.length;
        });
      });
      console.log(`[auto-complete] batch ${batchNo}: updated ${ids.length}`);
    }

    console.log(`[auto-complete] done. total updated = ${updatedCount}`);
  } catch (err) {
    console.error('[auto-complete] failed:', err);
    // 告警（可选）：通过环境变量指定 webhook
    const webhook = process.env.ALERT_WEBHOOK_URL;
    if (webhook) {
      try {
        // Node18+ 全局 fetch
        if (typeof fetch === 'function') {
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'auto_complete_failed',
              message: String(err?.message || err),
              time: new Date().toISOString()
            })
          });
        }
      } catch (_) {}
    }
    process.exitCode = 1;
  } finally {
    if (db.end) await db.end();
  }
}

if (require.main === module) {
  runAutoComplete();
}

module.exports = runAutoComplete;

