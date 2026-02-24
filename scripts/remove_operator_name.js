const { neon } = require('@neondatabase/serverless');

async function run() {
    const sql = neon('postgresql://neondb_owner:npg_pDu8R7LkAwiv@ep-patient-bird-a1hf50t1.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
    try {
        console.log('Dropping operator_name column...');
        await sql`ALTER TABLE fee_audit_logs DROP COLUMN IF EXISTS operator_name;`;
        console.log('Success.');
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
