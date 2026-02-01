const updateScheduleStatus = require('../src/server/jobs/updateScheduleStatus');

async function run() {
    console.log('--- Manually Triggering Auto Update ---');
    try {
        const result = await updateScheduleStatus();
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

run();
