const fs = require('fs');
const path = require('path');
const db = require('../db/db');

async function fetchTables() {
  const q = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  const res = await db.query(q);
  return (res.rows || []).map(r => r.table_name);
}

async function fetchColumns(table) {
  const q = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
  `;
  const res = await db.query(q, [table]);
  return res.rows || [];
}

async function fetchPK(table) {
  const q = `
    SELECT c.conname, pg_get_constraintdef(c.oid) AS condef
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = $1 AND c.contype = 'p';
  `;
  const res = await db.query(q, [table]);
  const row = (res.rows || [])[0];
  if (!row) return null;
  // condef example: 'PRIMARY KEY (id)'
  const m = /PRIMARY KEY \(([^\)]+)\)/i.exec(row.condef || '');
  const cols = m ? m[1].split(',').map(s => s.trim()) : [];
  return { name: row.conname, columns: cols };
}

async function fetchFKs(table) {
  const q = `
    SELECT c.conname, pg_get_constraintdef(c.oid) AS condef, c.confrelid::regclass AS ref_table
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = $1 AND c.contype = 'f';
  `;
  const res = await db.query(q, [table]);
  const rows = res.rows || [];
  // condef example: 'FOREIGN KEY (teacher_id) REFERENCES teachers(id)'
  return rows.map(r => {
    const def = String(r.condef || '');
    const colMatch = /FOREIGN KEY \(([^\)]+)\)/i.exec(def);
    const cols = colMatch ? colMatch[1].split(',').map(s => s.trim()) : [];
    const refMatch = /REFERENCES\s+([\w\d_]+)\s*\(([^\)]+)\)/i.exec(def);
    const refTable = (refMatch && refMatch[1]) || String(r.ref_table || '');
    const refCols = refMatch ? refMatch[2].split(',').map(s => s.trim()) : [];
    return { name: r.conname, columns: cols, ref_table: refTable, ref_columns: refCols };
  });
}

async function fetchIndexes(table) {
  const q = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
    ORDER BY indexname;
  `;
  const res = await db.query(q, [table]);
  return res.rows || [];
}

async function fetchTableComment(table) {
  const q = `
    SELECT obj_description(c.oid) AS comment
    FROM pg_class c
    WHERE c.relname = $1 AND c.relkind = 'r';
  `;
  const res = await db.query(q, [table]);
  const row = (res.rows || [])[0];
  return row ? (row.comment || '') : '';
}

async function fetchColumnComments(table) {
  const q = `
    SELECT a.attname AS column_name, col_description(c.oid, a.attnum) AS comment
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum;
  `;
  const res = await db.query(q, [table]);
  const entries = (res.rows || []).filter(r => r.comment);
  const map = {};
  entries.forEach(r => { map[r.column_name] = r.comment; });
  return map;
}

function inferBusinessMeaning(table, columns) {
  const name = table.toLowerCase();
  // 简单规则推断业务含义
  if (name.includes('admin')) return '管理员账户与权限相关信息';
  if (name.includes('teacher')) return '教师基本信息、可用性、排课与确认';
  if (name.includes('student')) return '学生信息、可用性与课程关联';
  if (name.includes('schedule_types')) return '课程/活动类型定义字典';
  if (name === 'schedules') return '课程排期记录（时间、教师、状态、地点等）';
  if (name.includes('schedule_students')) return '课程与学生的多对多关联';
  if (name.includes('confirm')) return '排课确认记录（教师/管理员确认）';
  return '业务表（依据字段名可进一步细化）';
}

function toMermaidER(tablesMeta) {
  const lines = ['```mermaid', 'erDiagram'];
  const fkLines = [];
  tablesMeta.forEach(t => {
    lines.push(`  ${t.name} {`);
    t.columns.forEach(c => {
      const pkTag = (t.pk && t.pk.columns.includes(c.column_name)) ? ' PK' : '';
      lines.push(`    ${c.data_type} ${c.column_name}${pkTag}`);
    });
    lines.push('  }');
    (t.fks || []).forEach(fk => {
      // many-to-one from child to parent -> o{ child } }| parent
      fkLines.push(`  ${t.name} }o--|| ${fk.ref_table} : ${fk.columns.join(',')}→${fk.ref_columns.join(',')}`);
    });
  });
  lines.push(...fkLines);
  lines.push('```');
  return lines.join('\n');
}

async function generate() {
  try {
    const tables = await fetchTables();
    const meta = [];
    for (const t of tables) {
      const columns = await fetchColumns(t);
      const pk = await fetchPK(t);
      const fks = await fetchFKs(t);
      const indexes = await fetchIndexes(t);
      const tableComment = await fetchTableComment(t);
      const colComments = await fetchColumnComments(t);
      meta.push({
        name: t,
        columns,
        pk,
        fks,
        indexes,
        comments: { table: tableComment, columns: colComments },
        meaning: inferBusinessMeaning(t, columns)
      });
    }

    // 生成 Markdown 文档
    const out = [];
    out.push('# 数据库文档');
    out.push('');
    out.push('## 表名列表');
    tables.forEach(t => out.push(`- ${t}`));
    out.push('');
    out.push('## 表间关系图');
    out.push(toMermaidER(meta));
    out.push('');
    out.push('## 表详细说明');
    meta.forEach(t => {
      out.push(`### ${t.name}`);
      out.push(`- 业务含义：${t.meaning}`);
      if (t.comments.table) out.push(`- 表注释：${t.comments.table}`);
      out.push('- 字段');
      t.columns.forEach(c => {
        const isPK = t.pk && t.pk.columns.includes(c.column_name);
        const comment = t.comments.columns[c.column_name] || '';
        out.push(`  - ${c.column_name} (${c.data_type}${c.is_nullable === 'NO' ? ', NOT NULL' : ''}${c.column_default ? `, DEFAULT ${c.column_default}` : ''}${isPK ? ', PK' : ''})${comment ? `：${comment}` : ''}`);
      });
      if (t.pk) {
        out.push(`- 主键：${t.pk.columns.join(', ')}`);
      }
      if (t.fks && t.fks.length > 0) {
        out.push('- 外键：');
        t.fks.forEach(fk => {
          out.push(`  - ${fk.name}: (${fk.columns.join(', ')}) → ${fk.ref_table}(${fk.ref_columns.join(', ')})`);
        });
      }
      if (t.indexes && t.indexes.length > 0) {
        out.push('- 索引：');
        t.indexes.forEach(ix => out.push(`  - ${ix.indexname}: ${ix.indexdef}`));
      }
      out.push('');
    });

    const docsDir = path.join(__dirname, '../../..', 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);
    const outPath = path.join(docsDir, 'db-schema.md');
    fs.writeFileSync(outPath, out.join('\n'), 'utf8');
    console.log('已生成文档：', outPath);
  } catch (err) {
    console.error('生成数据库文档失败：', err.message || err);
    process.exitCode = 1;
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  generate();
}

module.exports = generate;
