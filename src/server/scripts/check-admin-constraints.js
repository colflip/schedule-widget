const db = require('../db/db');

(async () => {
  try {
    const constraints = await db.query(`
      SELECT c.conname, c.contype
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'administrators'
      ORDER BY c.conname;
    `);
    console.table(constraints.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();