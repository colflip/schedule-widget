const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

// 统一获取 JWT 密钥（开发环境回退到不安全默认值）
function getJwtSecret() {
    return process.env.JWT_SECRET || 'dev-insecure-secret';
}

// 从数据库行中获取可能的密码字段（兼容多种命名与明文回退）
function getPasswordField(row) {
    if (!row || typeof row !== 'object') return null;
    return (
        row.password_hash ||
        row.passwordHash ||
        row.password ||
        row.pwd ||
        null
    );
}

// 检查候选密码是否看起来是 bcrypt 哈希
function isBcryptHash(val) {
    return typeof val === 'string' && val.startsWith('$2');
}

// 登录路由
router.post('/login', async (req, res) => {
    try {
        const { username, password, userType } = req.body || {};
        if (!username || !password || !userType) {
            return res.status(400).json({ message: '缺少必填的登录信息' });
        }

        let table;
        switch (userType) {
            case 'admin':
                table = 'administrators';
                break;
            case 'teacher':
                table = 'teachers';
                break;
            case 'student':
                table = 'students';
                break;
            default:
                return res.status(400).json({ message: '无效的用户类型' });
        }

        // 仅支持远程数据库登录：移除本地离线登录逻辑

        // 查询用户
        const result = await db.query(
            `SELECT * FROM ${table} WHERE username = $1`,
            [String(username).trim()]
        );

        const rows = (result && result.rows) ? result.rows : (Array.isArray(result) ? result : []);
        if (rows.length === 0) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }

        const user = rows[0];

        // 检查账号状态：-1(删除)不能登录；0(暂停)允许登录但不可参与排课
        if (Object.prototype.hasOwnProperty.call(user, 'status')) {
            const st = Number(user.status);
            if (st === -1) {
                return res.status(403).json({ message: '账号已删除，无法登录' });
            }
        }
        const pwdCandidate = getPasswordField(user);
        if (!pwdCandidate) {
            // 避免在日志中访问未定义的属性导致崩溃
            const safeUserId = user && user.id ? user.id : null;
            const safeUsername = user && user.username ? user.username : String(username).trim();
            console.error(`登录错误: 用户记录缺少密码字段(${table})`, { userId: safeUserId, username: safeUsername });
            try {
                console.error('登录调试: 用户记录键列表 =', Object.keys(user || {}));
                console.error('登录调试: 用户记录 =', user);
                console.error('登录调试: 查询结果对象键 =', Object.keys(result || {}));
                console.error('登录调试: rows 类型/是否数组 =', typeof rows, Array.isArray(rows));
                console.error('登录调试: rows 值 =', rows);
            } catch (_) {}
            return res.status(500).json({ message: '用户数据缺少密码字段，请联系管理员' });
        }

        let validPassword = false;
        if (isBcryptHash(pwdCandidate)) {
            try {
                validPassword = await bcrypt.compare(password, pwdCandidate);
            } catch (e) {
                console.error('bcrypt 比较失败:', e?.message || e);
                return res.status(500).json({ message: '密码校验失败' });
            }
        } else {
            // 开发环境允许明文对比，生产环境禁止
            if (process.env.NODE_ENV === 'production') {
                console.error('检测到未加密密码字段，已拒绝(生产环境)');
                return res.status(500).json({ message: '用户密码数据异常，请联系管理员' });
            }
            validPassword = String(password) === String(pwdCandidate);
        }

        if (!validPassword) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }

        // 更新最近登录时间
        try {
            await db.query(`UPDATE ${table} SET last_login = NOW() WHERE id = $1`, [user.id]);
        } catch (e) {
            console.warn('更新最近登录时间失败:', e.message || e);
        }

        // 创建 JWT
        const token = jwt.sign(
            {
                id: user.id,
                userType,
                permissionLevel: user.permission_level || null
            },
            getJwtSecret(),
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                userType,
                status: user.status
            }
        });
    } catch (error) {
        // 更明确的错误返回
        const code = error && error.code ? String(error.code) : undefined;
        if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
            console.error('登录错误-数据库连接失败:', error);
            return res.status(503).json({ message: '数据库连接失败，请稍后重试' });
        }
        console.error('登录错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 注册路由（仅供管理员使用）
router.post('/register', async (req, res) => {
    try {
        const { username, password, name, userType, additionalInfo } = req.body;

        let table;
        switch (userType) {
            case 'admin':
                table = 'administrators';
                break;
            case 'teacher':
                table = 'teachers';
                break;
            case 'student':
                table = 'students';
                break;
            default:
                return res.status(400).json({ message: '无效的用户类型' });
        }

        // 检查用户名是否已存在
        const existingUser = await db.query(
            `SELECT id FROM ${table} WHERE username = $1`,
            [username]
        );

        const existingRows = (existingUser && existingUser.rows) ? existingUser.rows : (Array.isArray(existingUser) ? existingUser : []);
        if (existingRows.length > 0) {
            return res.status(400).json({ message: '用户名已存在' });
        }

        // 加密密码
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 准备插入数据
        let columns = ['username', 'password_hash', 'name'];
        let values = [username, passwordHash, name];
        let placeholders = ['$1', '$2', '$3'];
        let currentPlaceholder = 4;

        // 添加额外信息
        if (additionalInfo) {
            for (let [key, value] of Object.entries(additionalInfo)) {
                columns.push(key);
                values.push(value);
                placeholders.push(`$${currentPlaceholder++}`);
            }
        }

        // 构建 SQL 查询
        const query = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING id, username, name
        `;

        const result = await db.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 修改密码路由
router.post('/change-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword, userType } = req.body || {};
        if (!username || !oldPassword || !newPassword || !userType) {
            return res.status(400).json({ message: '缺少必填的修改密码信息' });
        }

        let table;
        switch (userType) {
            case 'admin':
                table = 'administrators';
                break;
            case 'teacher':
                table = 'teachers';
                break;
            case 'student':
                table = 'students';
                break;
            default:
                return res.status(400).json({ message: '无效的用户类型' });
        }

        // 验证旧密码
        const userResult = await db.query(
            `SELECT * FROM ${table} WHERE username = $1`,
            [String(username).trim()]
        );

        const userRows = (userResult && userResult.rows) ? userResult.rows : (Array.isArray(userResult) ? userResult : []);
        if (userRows.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }
        const currentPwd = getPasswordField(userRows[0]);
        if (!currentPwd) {
            return res.status(500).json({ message: '用户数据缺少密码字段，请联系管理员' });
        }
        let validPassword = false;
        if (isBcryptHash(currentPwd)) {
            try {
                validPassword = await bcrypt.compare(oldPassword, currentPwd);
            } catch (e) {
                console.error('bcrypt 比较失败:', e?.message || e);
                return res.status(500).json({ message: '密码校验失败' });
            }
        } else {
            if (process.env.NODE_ENV === 'production') {
                return res.status(500).json({ message: '用户密码数据异常，请联系管理员' });
            }
            validPassword = String(oldPassword) === String(currentPwd);
        }
        if (!validPassword) {
            return res.status(401).json({ message: '旧密码错误' });
        }

        // 加密新密码
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        // 更新密码，优先写入 password_hash，不存在则尝试 password
        try {
            await db.query(
                `UPDATE ${table} SET password_hash = $1 WHERE username = $2`,
                [newPasswordHash, String(username).trim()]
            );
        } catch (e) {
            const msg = (e && e.message) || '';
            if (/column\s+"?password_hash"?\s+of\s+relation/i.test(msg)) {
                await db.query(
                    `UPDATE ${table} SET password = $1 WHERE username = $2`,
                    [newPasswordHash, String(username).trim()]
                );
            } else {
                throw e;
            }
        }

        res.json({ message: '密码修改成功' });
    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

module.exports = router;
