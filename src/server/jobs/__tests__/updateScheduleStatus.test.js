const updateScheduleStatus = require('../updateScheduleStatus');
const db = require('../../db/db');

// Mock db
jest.mock('../../db/db', () => ({
    query: jest.fn(),
    runInTransaction: jest.fn(),
    end: jest.fn()
}));

describe('updateScheduleStatus Job', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should detect date column and query for expired records', async () => {
        // Mock detectDateColumn result (it uses db.query internally)
        db.query.mockResolvedValueOnce({ rows: [{ column_name: 'class_date' }] });

        // Mock the select query to return empty (no work to do)
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await updateScheduleStatus();

        expect(result.success).toBe(true);
        expect(result.updatedCount).toBe(0);
        expect(db.query).toHaveBeenCalledTimes(2); // 1 for column check, 1 for select
    });

    it('should update status and insert logs when records are found', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ column_name: 'class_date' }] });

        // Return one record to process
        db.query.mockResolvedValueOnce({
            rows: [{ id: 101, status: 'pending' }]
        });
        // Second select returns empty to stop the loop
        db.query.mockResolvedValueOnce({ rows: [] });

        // Mock transaction execution
        db.runInTransaction.mockImplementation(async (callback) => {
            // Create a mock client/query function
            const mockQuery = jest.fn();
            await callback({ query: mockQuery }, false);
        });

        const result = await updateScheduleStatus();

        expect(result.success).toBe(true);
        expect(result.updatedCount).toBe(1);
        expect(db.runInTransaction).toHaveBeenCalled();
    });
});
