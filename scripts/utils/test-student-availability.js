#!/usr/bin/env node
/**
 * 测试脚本：验证学生 availability 提交是否能成功持久化到数据库
 */

require('dotenv').config();

const http = require('http');
const url = require('url');
const jwt = require('jsonwebtoken');
const db = require('../src/server/db/db');

const JWT_SECRET = process.env.JWT_SECRET || 'schedule-widget-secret-key-2024';
const SERVER_URL = 'http://localhost:3001';

// 创建或获取测试学生ID
async function setupTestStudent() {
    try {
        // 检查是否存在测试学生
        const checkResult = await db.query(
            `SELECT id FROM students WHERE username = 'test_student_avail' LIMIT 1`
        );
        
        if (checkResult.rows && checkResult.rows.length > 0) {
            console.log('[测试] 找到已存在的测试学生:', checkResult.rows[0].id);
            return checkResult.rows[0].id;
        }

        // 否则创建新学生
        const createResult = await db.query(
            `INSERT INTO students (username, password_hash, name, profession, contact, visit_location, home_address, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
             RETURNING id`,
            ['test_student_avail', 'dummy_hash', '测试学生', '测试', '13800138000', '测试地点', '测试地址']
        );
        const studentId = createResult.rows[0].id;
        console.log('[测试] 创建测试学生:', studentId);
        return studentId;
    } catch (error) {
        console.error('[测试] 设置测试学生出错:', error.message);
        throw error;
    }
}

// 生成 JWT token
function generateToken(studentId) {
    return jwt.sign(
        { userId: studentId, userType: 'student' },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// 发送 HTTP 请求
function makeRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const reqUrl = url.parse(`${SERVER_URL}${path}`);
        const options = {
            hostname: reqUrl.hostname,
            port: reqUrl.port || 3001,
            path: reqUrl.path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        if (body) {
            const bodyStr = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// 主测试函数
async function runTest() {
    console.log('\n========== 学生 Availability 提交测试 ==========\n');

    try {
        // 1. 设置测试学生
        const studentId = await setupTestStudent();
        const token = generateToken(studentId);

        // 2. 准备测试数据（21条记录，与前端日志匹配）
        const today = new Date();
        const availabilityList = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            availabilityList.push(
                { date: dateStr, timeSlot: 'morning', isAvailable: false },
                { date: dateStr, timeSlot: 'afternoon', isAvailable: false },
                { date: dateStr, timeSlot: 'evening', isAvailable: true }
            );
        }

        console.log(`[测试] 准备提交 ${availabilityList.length} 条 availability 记录`);
        console.log('[测试] 样本记录:', availabilityList.slice(0, 3));

        // 3. 提交 availability
        console.log('\n[测试] 发送 POST /api/student/availability ...');
        const submitResp = await makeRequest(
            'POST',
            '/api/student/availability',
            { availabilityList },
            token
        );

        console.log(`[测试] 响应状态码: ${submitResp.statusCode}`);
        console.log('[测试] 响应体:', JSON.stringify(submitResp.body, null, 2));

        if (submitResp.statusCode !== 200) {
            throw new Error(`提交失败，状态码: ${submitResp.statusCode}`);
        }

        // 4. 等待一段时间确保数据库已提交
        await new Promise(r => setTimeout(r, 1000));

        // 5. 查询数据库验证数据是否写入
        console.log('\n[测试] 查询数据库验证数据写入 ...');
        const checkResult = await db.query(
            `SELECT COUNT(*) as count FROM student_daily_availability WHERE student_id = $1`,
            [studentId]
        );

        const recordCount = checkResult.rows[0].count;
        console.log(`[测试] 数据库中找到 ${recordCount} 条记录 (期望: ${availabilityList.length})`);

        if (recordCount === 0) {
            console.error('[测试] ❌ 失败：数据库中没有找到任何记录！');
            
            // 详细检查
            const sample = await db.query(
                `SELECT * FROM student_daily_availability WHERE student_id = $1 LIMIT 5`,
                [studentId]
            );
            console.log('[测试] 数据库查询结果:', sample.rows);
        } else if (recordCount === availabilityList.length) {
            console.log('[测试] ✅ 成功：所有记录都已正确写入数据库！');
            
            // 显示几条示例记录
            const sample = await db.query(
                `SELECT id, date, morning_available, afternoon_available, evening_available 
                 FROM student_daily_availability WHERE student_id = $1 
                 ORDER BY date LIMIT 5`,
                [studentId]
            );
            console.log('[测试] 数据库中的样本记录:');
            sample.rows.forEach(row => {
                console.log(`  - ${row.date}: morning=${row.morning_available}, afternoon=${row.afternoon_available}, evening=${row.evening_available}`);
            });
        } else {
            console.warn(`[测试] ⚠️  部分数据写入 (${recordCount}/${availabilityList.length})`);
        }

        console.log('\n========== 测试完成 ==========\n');
        process.exit(recordCount === availabilityList.length ? 0 : 1);
    } catch (error) {
        console.error('\n[测试] ❌ 测试发生错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行测试
runTest();
