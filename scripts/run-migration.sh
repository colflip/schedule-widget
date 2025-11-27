#!/bin/bash
# 数据库迁移快速参考 - 一键执行脚本

set -e

echo "🚀 Schedule Widget - Daily Availability 表迁移"
echo "================================================"
echo ""

# 1. 加载环境变量
echo "📝 加载环境变量..."
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
    echo "✓ 环境变量已加载"
else
    echo "❌ 错误: .env 文件不存在"
    exit 1
fi

# 2. 验证数据库连接
echo ""
echo "🔗 验证数据库连接..."
node -e "
const db = require('./src/server/db/db');
(async () => {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✓ 数据库连接成功');
    process.exit(0);
  } catch (e) {
    console.error('❌ 数据库连接失败:', e.message);
    process.exit(1);
  }
})();
" || exit 1

# 3. 备份现有数据
echo ""
echo "💾 备份现有数据..."
node scripts/run-migration-daily-availability.js || {
    echo "❌ 迁移执行失败"
    exit 1
}

# 4. 应用约束
echo ""
echo "🔐 应用 NOT NULL 约束..."
node scripts/apply-not-null-constraints.js || {
    echo "⚠️  约束应用遇到问题（如已存在可忽略）"
}

# 5. 验证结果
echo ""
echo "🔍 验证迁移结果..."
node scripts/verify-migration.js || {
    echo "❌ 验证失败"
    exit 1
}

# 6. 演示新功能
echo ""
read -p "是否运行演示脚本？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    node scripts/demo-new-structure.js
fi

echo ""
echo "✨ 迁移完成！"
echo ""
echo "📚 相关文档："
echo "  - MIGRATION_GUIDE.md: 详细迁移指南"
echo "  - DATABASE_SCHEMA_GUIDE.md: 数据库规范"
echo "  - MIGRATION_COMPLETION_REPORT.md: 执行报告"
