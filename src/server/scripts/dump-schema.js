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
    SELECT 
      column_name, 
      data_type, 
      is_nullable, 
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
  `;
    const res = await db.query(q, [table]);
    return res.rows || [];
}

async function fetchConstraints(table) {
    // PK and Checks
    const q = `
    SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) as condef
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = $1 AND c.contype IN ('p', 'c', 'u')
    ORDER BY c.contype DESC; -- Primary first
  `;
    const res = await db.query(q, [table]);
    return res.rows || [];
}

async function fetchFKs(table) {
    const q = `
    SELECT c.conname, pg_get_constraintdef(c.oid) as condef
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = $1 AND c.contype = 'f';
  `;
    const res = await db.query(q, [table]);
    return res.rows || [];
}

async function fetchIndexes(table) {
    // Exclude implicit indexes from constraints (PKs, Unique) to avoid duplication
    // This is a bit tricky, but simple index fetch is usually OK.
    // pg_indexes view shows all indexes.
    const q = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
    ORDER BY indexname;
  `;
    const res = await db.query(q, [table]);
    return res.rows || [];
}

async function fetchFunctions() {
    const q = `
    SELECT p.proname, pg_get_functiondef(p.oid) as funcdef
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public';
  `;
    const res = await db.query(q);
    return res.rows || [];
}

async function fetchTriggers(table) {
    const q = `
    SELECT tgname, pg_get_triggerdef(oid) as trigdef
    FROM pg_trigger
    WHERE tgrelid = $1::regclass AND tgisinternal = false;
  `;
    const res = await db.query(q, [table]);
    // pg_trigger oid is not the trigger oid for get_triggerdef, it takes the trigger oid directly?
    // pg_get_triggerdef(trigger_oid)
    const q2 = `
    SELECT t.tgname, pg_get_triggerdef(t.oid) as trigdef
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = $1 AND t.tgisinternal = false;
  `;
    const res2 = await db.query(q2, [table]);
    return res2.rows || [];
}

function formatColumn(c) {
    let type = c.data_type;
    if (type === 'character varying') {
        type = `VARCHAR(${c.character_maximum_length})`;
    } else if (type === 'character') {
        type = `CHAR(${c.character_maximum_length})`;
    } else if (type === 'timestamp without time zone') {
        type = 'TIMESTAMP';
    } else if (type === 'double precision') {
        type = 'FLOAT8'; // equivalent
    }

    // Clean up serials in next step if default contains nextval

    let line = `    ${c.column_name} ${type.toUpperCase()}`;

    if (c.is_nullable === 'NO') {
        line += ' NOT NULL';
    }

    if (c.column_default) {
        // Handle SERIAL
        if (c.column_default.includes('nextval')) {
            // Replace type with SERIAL/HERIAL
            if (type.includes('INTEGER')) line = `    ${c.column_name} SERIAL`;
            else if (type.includes('BIGINT')) line = `    ${c.column_name} BIGSERIAL`;
            // Remove default and NOT NULL since SERIAL implies it
            line = line.replace(' NOT NULL', '');
        } else {
            line += ` DEFAULT ${c.column_default}`;
        }
    }

    return line;
}

async function dump() {
    const out = [];

    // 1. Drop everything clean
    out.push('-- Clean up existing schema');
    const tables = await fetchTables();
    for (const t of tables) {
        out.push(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    }
    const funcs = await fetchFunctions();
    for (const f of funcs) {
        out.push(`DROP FUNCTION IF EXISTS ${f.proname} CASCADE;`);
    }
    out.push('');

    // 2. Functions
    if (funcs.length > 0) {
        out.push('-- Functions');
        for (const f of funcs) {
            out.push(f.funcdef + ';');
            out.push('');
        }
    }

    // 3. Tables schema (without FKs to avoid ordering issues)
    const allFKs = [];
    const allIndexes = [];
    const allTriggers = [];

    for (const t of tables) {
        out.push(`-- Table: ${t}`);
        out.push(`CREATE TABLE ${t} (`);

        const cols = await fetchColumns(t);
        const colLines = cols.map(formatColumn);

        // Add constraints inline (PK, Unique, Check) - EXCEPT FK
        const constraints = await fetchConstraints(t);
        const consLines = [];
        for (const c of constraints) {
            if (c.contype === 'p') {
                consLines.push(`    CONSTRAINT ${c.conname} ${c.condef}`);
            } else if (c.contype === 'u') {
                consLines.push(`    CONSTRAINT ${c.conname} ${c.condef}`);
            } else if (c.contype === 'c') {
                consLines.push(`    CONSTRAINT ${c.conname} ${c.condef}`);
            }
        }

        // Join columns and inline constraints
        const allBody = [...colLines, ...consLines];
        out.push(allBody.join(',\n'));
        out.push(');');
        out.push('');

        // Store FKs for later
        const fks = await fetchFKs(t);
        fks.forEach(fk => {
            allFKs.push({ table: t, ...fk });
        });

        // Store Indexes 
        const indexes = await fetchIndexes(t);
        // Filter out indexes that are implicitly created by constraints (PKs/Unique)
        // To be safe and simple, we might just dump all 'create index' statements that are not 'unique index' if we already have unique constraints?
        // Actually pg_indexes returns the full CREATE INDEX statement.
        // Standard Postgres usually creates implicit indexes for PK and UNIQUE.
        // If we include them again, it might fail or strictly duplicate.
        // Let's filter: exclude if indexname is same as a constraint name?
        const constraintNames = new Set(constraints.map(c => c.conname));
        indexes.forEach(ix => {
            if (!constraintNames.has(ix.indexname)) {
                allIndexes.push(ix.indexdef + ';');
            }
        });

        // Store Triggers
        const triggers = await fetchTriggers(t);
        triggers.forEach(tr => {
            allTriggers.push(tr.trigdef + ';');
        });
    }

    // 4. FKs
    if (allFKs.length > 0) {
        out.push('-- Foreign Keys');
        for (const fk of allFKs) {
            out.push(`ALTER TABLE ${fk.table} ADD CONSTRAINT ${fk.conname} ${fk.condef};`);
        }
        out.push('');
    }

    // 5. Indexes
    if (allIndexes.length > 0) {
        out.push('-- Indexes');
        for (const ix of allIndexes) {
            out.push(ix);
        }
        out.push('');
    }

    // 6. Triggers
    if (allTriggers.length > 0) {
        out.push('-- Triggers');
        for (const tr of allTriggers) {
            out.push(tr);
        }
        out.push('');
    }

    const result = out.join('\n');
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    fs.writeFileSync(schemaPath, result, 'utf8');
    console.log('Schema dumped to:', schemaPath);
    process.exit(0);
}

dump().catch(e => {
    console.error(e);
    process.exit(1);
});
