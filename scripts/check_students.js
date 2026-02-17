
const { query } = require('../src/server/db/db');

async function checkStudents() {
    const names = ['庄丰瑜', '宋林浩', '赵梓航', 'all-std'];

    console.log('Checking students...');
    for (const name of names) {
        // Try matching name or username
        const res = await query(
            `SELECT * FROM students WHERE name = $1 OR username = $1`,
            [name]
        );

        if (res.rows.length > 0) {
            console.log(`Found '${name}':`, res.rows[0]);
        } else {
            console.log(`Could not find student matching '${name}'`);
        }
    }
    process.exit(0);
}

checkStudents().catch(err => {
    console.error(err);
    process.exit(1);
});
