/*
 * 校验 seclude-types 映射字段与国际化要求
 * - 验证 key_en、name_zh、icon_scene、updated_at 字段存在性与格式
 * - 输出报告到 docs/seclude-types-mapping-report.md
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function validateRow(row) {
  const issues = [];
  if (!row.key_en || !/^([a-z]+(-[a-z]+)*)$/.test(row.key_en)) {
    issues.push('key_en 缺失或不符合kebab-case');
  }
  if (!row.name_zh || /[\u0000-\u001F]/.test(row.name_zh)) {
    issues.push('name_zh 缺失或包含非法字符');
  }
  if (!row.icon_scene) {
    issues.push('icon_scene 缺失');
  }
  if (!row.updated_at || isNaN(Date.parse(row.updated_at))) {
    issues.push('updated_at 缺失或不是有效时间戳');
  }
  return issues;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    console.error('未设置 DATABASE_URL/POSTGRES_URL 环境变量');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const res = await client.query('SELECT id, key_en, name_zh, icon_scene, updated_at FROM seclude_types ORDER BY id ASC');
    const rows = res.rows || [];
    const report = [];
    let errorCount = 0;

    report.push(`# seclude-types 映射校验报告`);
    report.push(`生成时间：${new Date().toISOString()}`);
    report.push('');
    report.push('| id | key_en | name_zh | icon_scene | updated_at | 结果 |');
    report.push('|---:|--------|---------|------------|------------|------|');

    rows.forEach(r => {
      const issues = validateRow(r);
      if (issues.length) errorCount += 1;
      report.push(`| ${r.id} | ${r.key_en || ''} | ${r.name_zh || ''} | ${r.icon_scene || ''} | ${r.updated_at || ''} | ${issues.length ? ('❌ ' + issues.join('; ')) : '✅ 通过'} |`);
    });

    const outPath = path.resolve(__dirname, '../../../docs/seclude-types-mapping-report.md');
    fs.writeFileSync(outPath, report.join('\n'), 'utf-8');
    console.log(`校验完成：${rows.length} 条记录，错误 ${errorCount} 条。报告已生成：${outPath}`);
    process.exit(errorCount ? 2 : 0);
  } catch (err) {
    console.error('查询或校验失败：', err);
    process.exit(2);
  } finally {
    await client.end();
  }
}

main();

