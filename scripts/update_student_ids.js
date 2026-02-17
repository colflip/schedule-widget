
const { query, runInTransaction } = require('../src/server/db/db');

const MAPPINGS = [
    { name: '庄丰瑜', newId: 1001 },
    { name: '宋林浩', newId: 2001 },
    { name: '赵梓航', newId: 2002 },
    { name: 'all-std', newId: 9999 }
];

async function updateStudentId(client, oldId, newId, studentData) {
    console.log(`Updating student '${studentData.name}' from ID ${oldId} to ${newId}...`);

    // 1. Rename old username to free it up
    const tempUsername = `${studentData.username}_old_${oldId}`;
    await client.query('UPDATE students SET username = $1 WHERE id = $2', [tempUsername, oldId]);

    // 2. Insert new student record with new ID
    // We explicitly list columns to avoid issues if schema changes slightly, but taking common ones
    const cols = ['id', 'username', 'password_hash', 'name', 'profession', 'contact', 'visit_location', 'home_address', 'created_at', 'last_login', 'status'];
    const values = [newId, studentData.username, studentData.password_hash, studentData.name, studentData.profession, studentData.contact, studentData.visit_location, studentData.home_address, studentData.created_at, studentData.last_login, studentData.status];

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(`INSERT INTO students (${cols.join(', ')}) VALUES (${placeholders})`, values);

    // 3. Update related tables
    // course_arrangement
    const resCA = await client.query('UPDATE course_arrangement SET student_id = $1 WHERE student_id = $2', [newId, oldId]);
    console.log(`  - Updated ${resCA.rowCount} course_arrangement records`);

    // student_daily_availability
    const resSDA = await client.query('UPDATE student_daily_availability SET student_id = $1 WHERE student_id = $2', [newId, oldId]);
    console.log(`  - Updated ${resSDA.rowCount} student_daily_availability records`);

    // 4. Delete old student record
    await client.query('DELETE FROM students WHERE id = $1', [oldId]);
    console.log(`  - Deleted old student record (ID: ${oldId})`);
}

async function main() {
    await runInTransaction(async (client) => {
        for (const mapping of MAPPINGS) {
            // Find current student
            const res = await client.query('SELECT * FROM students WHERE name = $1', [mapping.name]);
            if (res.rows.length === 0) {
                console.warn(`Student '${mapping.name}' not found. Skipping.`);
                continue;
            }

            const student = res.rows[0];
            const oldId = student.id;

            if (oldId === mapping.newId) {
                console.log(`Student '${mapping.name}' already has ID ${mapping.newId}. Skipping.`);
                continue;
            }

            // Check if target ID exists (safety check)
            const targetCheck = await client.query('SELECT id FROM students WHERE id = $1', [mapping.newId]);
            if (targetCheck.rows.length > 0) {
                throw new Error(`Target ID ${mapping.newId} for '${mapping.name}' already exists! Aborting.`);
            }

            await updateStudentId(client, oldId, mapping.newId, student);
        }
    });

    console.log('All updates completed successfully.');
}

main().then(() => process.exit(0)).catch(err => {
    console.error('Error during update:', err);
    process.exit(1);
});
