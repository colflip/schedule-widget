const { describe, test, expect } = require('@jest/globals');

/**
 * Re-implementation of the filtering logic from admin.js for testing purposes.
 * This ensures the algorithm logic is correct given specific inputs.
 */
function filterTeachers(params) {
    // Inputs
    const {
        allTeachers,
        schedules,
        availabilityMap,
        targetStart,
        targetEnd,
        currentScheduleId
    } = params;

    // Time Slots Logic
    const checkSlots = { morning: false, afternoon: false, evening: false };
    const mStart = 6 * 60;
    const mEnd = 12 * 60;
    const aEnd = 19 * 60;
    const eEnd = 24 * 60;

    if (!(targetEnd <= mStart || targetStart >= mEnd)) checkSlots.morning = true;
    if (!(targetEnd <= mEnd || targetStart >= aEnd)) checkSlots.afternoon = true;
    if (!(targetEnd <= aEnd || targetStart >= eEnd)) checkSlots.evening = true;

    // 1. Busy Calculation
    const busyIds = new Set();
    (schedules || []).forEach(s => {
        if (currentScheduleId && String(s.id) === String(currentScheduleId)) return;
        if (s.status === 'cancelled') return;

        // Simplified time parsing for test (assuming minutes are passed or simple parser)
        // In app: hhmmToMinutes. Here we assume s.start_time/end_time are in minutes or we parse them.
        // Let's assume input schedules have start_minutes/end_minutes for simplicity of logic test.
        const sStart = s.start_minutes;
        const sEnd = s.end_minutes;

        if (!(sEnd <= targetStart || sStart >= targetEnd)) {
            busyIds.add(Number(s.teacher_id));
        }
    });

    // 2. Unavailable Calculation
    const unavailableIds = new Set();
    const dateVal = '2026-01-01'; // Dummy date

    allTeachers.forEach(t => {
        const tid = Number(t.id);
        const restriction = t.restriction ?? 1;

        if (restriction === 0) return; // Always available
        if (restriction === 1) { // Check availability
            const teacherAvail = availabilityMap[tid];
            let dayRecord = teacherAvail ? teacherAvail[dateVal] : null; // Assume direct match for test

            if (!dayRecord) return; // Assume available

            let isOk = true;
            if (checkSlots.morning && dayRecord.morning === false) isOk = false;
            if (checkSlots.afternoon && dayRecord.afternoon === false) isOk = false;
            if (checkSlots.evening && dayRecord.evening === false) isOk = false;

            if (!isOk) unavailableIds.add(tid);
        }
    });

    return { busyIds, unavailableIds };
}

describe('Teacher Availability Filtering', () => {
    // Mock Data
    const teachers = [
        { id: 1, name: 'T1', restriction: 1 }, // Normal
        { id: 2, name: 'T2', restriction: 0 }, // Special (Always Available)
        { id: 3, name: 'T3', restriction: 1 }, // Normal
    ];

    const availabilityMap = {
        1: { '2026-01-01': { morning: true, afternoon: true, evening: false } }, // T1: No Evening
        3: { '2026-01-01': { morning: true, afternoon: false, evening: true } }, // T3: No Afternoon
    };

    test('should identify busy teachers correctly', () => {
        const schedules = [
            { id: 101, teacher_id: 1, start_minutes: 600, end_minutes: 720, status: 'confirmed' } // 10:00 - 12:00
        ];

        // Target: 11:00 - 13:00 (Overlap with T1)
        const result = filterTeachers({
            allTeachers: teachers,
            schedules: schedules,
            availabilityMap: availabilityMap,
            targetStart: 660, // 11:00
            targetEnd: 780,   // 13:00
            currentScheduleId: null
        });

        expect(result.busyIds.has(1)).toBe(true);
        expect(result.busyIds.has(2)).toBe(false);
    });

    test('should hide unavailability based on time slots', () => {
        // Target: 20:00 - 21:00 (Evening) -> T1 is unavailable (evening: false)
        const result = filterTeachers({
            allTeachers: teachers,
            schedules: [],
            availabilityMap: availabilityMap,
            targetStart: 1200, // 20:00
            targetEnd: 1260,   // 21:00
            currentScheduleId: null
        });

        expect(result.unavailableIds.has(1)).toBe(true); // T1 restricted evening
        expect(result.unavailableIds.has(2)).toBe(false); // T2 ignored
        expect(result.unavailableIds.has(3)).toBe(false); // T3 ok evening
    });

    test('should allow available time slots', () => {
        // Target: 10:00 - 11:00 (Morning) -> Everyone ok
        const result = filterTeachers({
            allTeachers: teachers,
            schedules: [],
            availabilityMap: availabilityMap,
            targetStart: 600, // 10:00
            targetEnd: 660,   // 11:00
            currentScheduleId: null
        });

        expect(result.unavailableIds.size).toBe(0);
    });
});
