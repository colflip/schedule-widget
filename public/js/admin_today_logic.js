
// 加载今日排课
async function loadTodaySchedules() {
    const container = document.getElementById('todayScheduleList');
    if (!container) return;

    container.innerHTML = '<div class="no-data" style="text-align: center; color: #64748b; padding: 20px;">加载中...</div>';

    try {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];

        // 复用 WeeklyDataStore.getSchedules 或直接调用 API
        // 这里直接调用 API 以获取今日所有排课（不分老师/学生）
        const schedules = await window.apiUtils.get('/admin/schedules/grid', {
            start_date: dateStr,
            end_date: dateStr
        });

        const normalized = normalizeScheduleRows(Array.isArray(schedules) ? schedules : []);
        renderTodaySchedules(normalized);
    } catch (error) {
        console.error('加载今日排课失败:', error);
        container.innerHTML = '<div class="no-data" style="text-align: center; color: #ef4444; padding: 20px;">加载失败，请重试</div>';
    }
}

// 渲染今日排课列表
function renderTodaySchedules(schedules) {
    const container = document.getElementById('todayScheduleList');
    if (!container) return;

    container.innerHTML = '';

    if (schedules.length === 0) {
        container.innerHTML = '<div class="no-data" style="text-align: center; color: #64748b; padding: 20px;">今日暂无排课</div>';
        return;
    }

    // 按时间排序
    schedules.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    schedules.forEach(schedule => {
        const card = document.createElement('div');
        // 复用 group-picker-item 样式，因为它已经包含了我们需要的布局
        // 需要根据时间段添加 slot-xxx 类以获得背景色
        const hour = parseInt((schedule.start_time || '00').split(':')[0], 10);
        let slot = 'morning';
        if (hour >= 12) slot = 'afternoon';
        if (hour >= 18) slot = 'evening';

        const status = (schedule.status || 'pending').toLowerCase();
        const statusClass = `status-${status}`;

        card.className = `group-picker-item slot-${slot} ${statusClass}`;
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.padding = '12px';
        card.style.border = '1px solid #e2e8f0';
        card.style.borderRadius = '8px';
        card.style.marginBottom = '8px';

        // 状态文本映射
        const statusTextMap = {
            'pending': '待确认',
            'confirmed': '已确认',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        const statusText = statusTextMap[status] || status;

        // 类型样式映射
        let typeClass = 'type-default';
        const typeName = schedule.schedule_type_name || schedule.type_name || '课程';
        if (typeName.includes('入户')) typeClass = 'type-visit';
        else if (typeName.includes('试教')) typeClass = 'type-trial';
        else if (typeName.includes('评审')) typeClass = 'type-review';
        else if (typeName.includes('半次')) typeClass = 'type-half-visit';
        else if (typeName.includes('集体')) typeClass = 'type-group-activity';

        card.innerHTML = `
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span class="time-text" style="font-weight: 600; font-size: 14px;">${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}</span>
                    <span class="chip ${typeClass}" style="font-size: 12px;">${typeName}</span>
                    <span class="chip ${statusClass}" style="font-size: 12px;">${statusText}</span>
                </div>
                <div style="font-size: 13px; color: #475569;">
                    <span style="margin-right: 8px;"><i class="material-icons-round" style="font-size: 14px; vertical-align: text-bottom;">person</i> ${schedule.student_name || '未知学生'}</span>
                    <span><i class="material-icons-round" style="font-size: 14px; vertical-align: text-bottom;">face</i> ${schedule.teacher_name || '未分配'}</span>
                </div>
                ${schedule.location ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;"><i class="material-icons-round" style="font-size: 14px; vertical-align: text-bottom;">place</i> ${schedule.location}</div>` : ''}
            </div>
        `;

        // 点击编辑
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => editSchedule(schedule.id));

        container.appendChild(card);
    });
}
