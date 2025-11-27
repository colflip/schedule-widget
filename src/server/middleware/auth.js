const jwt = require('jsonwebtoken');

function getJwtSecret() {
    return process.env.JWT_SECRET || 'dev-insecure-secret';
}

const isOfflineDev = process.env.OFFLINE_DEV === 'true';
console.log('离线开发模式状态:', isOfflineDev);

const authMiddleware = async (req, res, next) => {
    try {
        // 离线开发模式：跳过鉴权，模拟用户
        if (isOfflineDev) {
            console.log('离线开发模式激活，当前请求路径:', req.path);
            // 检查请求路径来确定模拟的用户类型
            // 修复：检查baseUrl或完整URL是否包含/teacher路径
            const fullPath = req.baseUrl + req.path;
            console.log('完整请求路径:', fullPath);
            if (fullPath && (fullPath.includes('/teacher') || req.path.includes('/teacher'))) {
                console.log('检测到教师路径，模拟教师用户');
                // 模拟教师用户（使用数据库中实际存在的教师ID）
                req.user = { id: 40, userType: 'teacher', permissionLevel: 2 };
            } else {
                console.log('未检测到教师路径，模拟管理员用户');
                // 模拟管理员用户
                req.user = { id: 1, userType: 'admin', permissionLevel: 1 };
            }
            return next();
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: '未提供认证令牌' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, getJwtSecret());
        
        req.user = {
            id: decoded.id,
            userType: decoded.userType,
            permissionLevel: decoded.permissionLevel
        };
        
        next();
    } catch (error) {
        const msg = (error && error.name === 'TokenExpiredError') ? '认证令牌已过期' : '无效的认证令牌';
        return res.status(401).json({ message: msg });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: '需要管理员权限' });
    }
    next();
};

const checkPermissionLevel = (level) => {
    return (req, res, next) => {
        if (req.user.userType === 'admin' && req.user.permissionLevel > level) {
            return res.status(403).json({ message: '权限不足' });
        }
        next();
    };
};

module.exports = {
    authMiddleware,
    adminOnly,
    checkPermissionLevel
};