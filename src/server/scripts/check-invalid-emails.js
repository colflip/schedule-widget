const db = require('../db/db');

const EMAIL_RE = '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]\\.[A-Za-z]{2,}$';

(async () => {
  try {
    const res = await db.query(`SELECT id, username, email, length(email) AS len, email LIKE '%''%' AS has_quote FROM administrators WHERE NOT (email ~* '${EMAIL_RE}') OR email IS NULL OR email = ''`);
    console.log('Invalid emails count:', res.rows.length);
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();