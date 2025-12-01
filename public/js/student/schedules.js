import { API_ENDPOINTS, STATUS_LABELS, EMPTY_STATES, SCHEDULE_TYPE_MAP } from './constants.js';
import {
    clearChildren,
    createElement,
    formatTimeRange,
    formatWeekRangeText,
    getWeekDates,
    normalizeDateKey,
    setText,
    showInlineFeedback,
    toISODate,
    handleApiError,
    startOfWeek,
    getTimeSlotId
} from './utils.js';

let currentWeekStart = null;
let cachedSchedules = [];

const elements = {
    header: () => document.getElementById('weeklyHeader'),
    body: () => document.getElementById('weeklyBody'),
    rangeLabel: () => document.getElementById('weekRange'),
    feedback: () => document.getElementById('scheduleFeedback'),
    prevWeekBtn: () => document.getElementById('prevWeek'),
    nextWeekBtn: () => document.getElementById('nextWeek')
};

export async function initSchedulesSection() {
    currentWeekStart = currentWeekStart || startOfWeek(new Date());
    bindNavigation();
    await loadSchedules(currentWeekStart);
}

function bindNavigation() {
    const prevBtn = elements.prevWeekBtn();
    const nextBtn = elements.nextWeekBtn();

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            loadSchedules(currentWeekStart);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            loadSchedules(currentWeekStart);
        });
    }
}

export async function loadSchedules(baseDate) {
    const weekStart = startOfWeek(baseDate);
    currentWeekStart = weekStart;
    const weekDates = getWeekDates(weekStart);
    updateWeekRangeLabel(weekDates);
    showLoadingState();

    try {
        const startDate = toISODate(weekDates[0]);
        const endDate = toISODate(weekDates[weekDates.length - 1]);

        const response = await fetch(
            `${API_ENDPOINTS.SCHEDULES}?startDate=${startDate}&endDate=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('获取课程安排失败');
        }

        const schedules = await response.json();
        cachedSchedules = Array.isArray(schedules) ? schedules : [];
        renderSchedules(weekDates, cachedSchedules);
        showInlineFeedback(elements.feedback(), '', 'info');
    } catch (error) {
        console.error('加载学生课程安排失败', error);
        renderEmptyState(EMPTY_STATES.schedules);
        showInlineFeedback(elements.feedback(), '加载课程安排失败，请稍后重试', 'error');
    }
}

function renderSchedules(weekDates, schedules) {
    const grouped = groupSchedulesByDate(weekDates, schedules);

    // Apply merging logic
    grouped.forEach((list, date) => {
        grouped.set(date, mergeSchedules(list));
    });

    // 检测是否为移动端
    if (isMobileView()) {
        renderMobileScheduleTable(weekDates, grouped);
    } else {
        renderHeader(weekDates);
        renderBody(weekDates, grouped);
    }
}

function mergeSchedules(schedules) {
    if (!schedules || schedules.length === 0) return [];

    const mergedMap = new Map();

    schedules.forEach(schedule => {
        // Key: date + start_time + end_time (Ignore type for merging key)
        const key = `${schedule.start_time}-${schedule.end_time}`;

        if (!mergedMap.has(key)) {
            mergedMap.set(key, {
                ...schedule,
                isMerged: false,
                mergedCount: 1,
                mergedIds: [schedule.id],
                originalSchedules: [schedule],
                teachers: [{
                    name: schedule.teacher_name || '未分配教师',
                    type: schedule.schedule_type_cn || schedule.schedule_type || '课程',
                    status: schedule.status
                }]
            });
        } else {
            const existing = mergedMap.get(key);
            existing.isMerged = true;
            existing.mergedCount++;
            existing.mergedIds.push(schedule.id);
            existing.originalSchedules.push(schedule);

            // Add teacher detail
            existing.teachers.push({
                name: schedule.teacher_name || '未分配教师',
                type: schedule.schedule_type_cn || schedule.schedule_type || '课程',
                status: schedule.status
            });

            // Merge locations if different
            if (schedule.location && existing.location !== schedule.location) {
                if (!existing.location) {
                    existing.location = schedule.location;
                } else if (!existing.location.includes(schedule.location)) {
                    existing.location += `, ${schedule.location}`;
                }
            }
        }
    });

    return Array.from(mergedMap.values());
}

function groupSchedulesByDate(weekDates, schedules) {
    const grouped = new Map();
    weekDates.forEach(date => grouped.set(toISODate(date), []));

    schedules.forEach(item => {
        const keyCandidates = [
            item.date,
            item.start_date,
            item.lesson_date,
            item.schedule_date
        ];
        const key = keyCandidates
            .map(normalizeDateKey)
            .find(Boolean);
        if (!key) return;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(item);
    });

    grouped.forEach(list => list.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
    return grouped;
}

// 检测移动端视口
function isMobileView() {
    return window.innerWidth <= 768;
}

// 移动端2列7行表格渲染
function renderMobileScheduleTable(weekDates, grouped) {
    const container = document.querySelector('#schedules .table-container');
    if (!container) return;

    clearChildren(container);

    // 创建表格（不添加标题）
    const table = createElement('table', 'mobile-schedule-table');

    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const dateHeader = createElement('th', '', { textContent: '日期' });
    const detailsHeader = createElement('th', '', { textContent: '课程详情' });
    headerRow.appendChild(dateHeader);
    headerRow.appendChild(detailsHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 创建表体
    const tbody = document.createElement('tbody');
    weekDates.forEach(date => {
        const iso = toISODate(date);
        const row = document.createElement('tr');

        // 日期列
        const day = date.getDate();
        const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdayNames[date.getDay()];
        const dateLabel = `${day}/${weekday}`;
        const dateCell = createElement('td', 'mobile-date-cell', { textContent: dateLabel });
        row.appendChild(dateCell);

        // 课程详情列
        const detailsCell = createElement('td', 'mobile-details-cell');
        const dailySchedules = grouped.get(iso) || [];

        if (dailySchedules.length === 0) {
            const empty = createElement('div', 'no-schedule', { textContent: '暂无排课' });
            detailsCell.appendChild(empty);
        } else {
            dailySchedules.forEach((schedule, index) => {
                const detail = buildMobileScheduleDetail(schedule);
                detailsCell.appendChild(detail);
                // 添加分隔线（除了最后一个）
                if (index < dailySchedules.length - 1) {
                    const divider = createElement('hr', 'schedule-divider');
                    divider.style.cssText = 'margin: 8px 0; border: none; border-top: 1px solid #e9ecef;';
                    detailsCell.appendChild(divider);
                }
            });
        }

        row.appendChild(detailsCell);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

// 构建移动端课程详情块
function buildMobileScheduleDetail(schedule) {
    // 课程类型
    const typeCode = schedule.schedule_type || '';
    const typeLabel = schedule.schedule_type_cn || SCHEDULE_TYPE_MAP[typeCode] || typeCode || '课程';
    let typeClass = 'type-default';
    if (typeLabel.includes('入户')) typeClass = 'type-visit';
    else if (typeLabel.includes('试教')) typeClass = 'type-trial';
    else if (typeLabel.includes('评审')) typeClass = 'type-review';
    else if (typeLabel.includes('半次')) typeClass = 'type-half-visit';
    else if (typeLabel.includes('集体')) typeClass = 'type-group-activity';

    // 状态
    const status = (schedule.status || 'pending').toLowerCase();
    const displayStatus = getDisplayStatus(schedule);

    // 获取时间段（用于背景色）
    const slotId = getTimeSlotId(schedule.start_time);
    const slotClass = slotId ? `slot-${slotId}` : 'slot-unspecified';

    // 创建卡片容器（使用 group-picker-item 保持与PC端一致的样式）
    const detail = createElement('div', `group-picker-item ${slotClass} status-${status}`);
    // 移除内联样式，使用 group-picker-item 的 CSS
    detail.style.cssText = 'display: flex; flex-direction: column; gap: 8px; align-items: stretch;';

    // 信息容器
    const infoContainer = createElement('div', '', {
        style: 'font-size: 13px; line-height: 1.6; word-break: break-all;'
    });

    // 构建显示文本
    // 格式：张老师（入户，已确认），周老师（入户，已确认），19:00-21:00，新课堂5楼
    const teachers = schedule.teachers || [{
        name: schedule.teacher_name || '未分配教师',
        type: schedule.schedule_type_cn || schedule.schedule_type || '课程',
        status: schedule.status
    }];

    teachers.forEach((t, index) => {
        // Teacher Name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = t.name;
        infoContainer.appendChild(nameSpan);

        infoContainer.appendChild(document.createTextNode(' ('));

        // Type Chip
        let typeClass = 'type-default';
        if (t.type.includes('入户')) typeClass = 'type-visit';
        else if (t.type.includes('试教')) typeClass = 'type-trial';
        else if (t.type.includes('评审')) typeClass = 'type-review';
        else if (t.type.includes('半次')) typeClass = 'type-half-visit';
        else if (t.type.includes('集体')) typeClass = 'type-group-activity';

        const typeChip = createElement('span', `chip ${typeClass}`, {
            textContent: t.type,
            style: 'font-size: 11px; padding: 1px 6px; border-radius: 4px; margin: 0 2px; vertical-align: middle;'
        });
        infoContainer.appendChild(typeChip);

        infoContainer.appendChild(document.createTextNode(', '));

        // Status Chip
        const displayStatus = getDisplayStatus({ status: t.status });
        const statusChip = createElement('span', `chip status-${t.status}`, {
            textContent: displayStatus,
            style: 'font-size: 11px; padding: 1px 6px; border-radius: 4px; margin: 0 2px; vertical-align: middle;'
        });
        infoContainer.appendChild(statusChip);

        infoContainer.appendChild(document.createTextNode(')'));

        if (index < teachers.length - 1) {
            infoContainer.appendChild(document.createTextNode(', '));
        }
    });

    const timeText = formatTimeRange(schedule.start_time, schedule.end_time);
    const locationText = schedule.location || '上课地点未确定';

    infoContainer.appendChild(document.createTextNode(`, ${timeText}, ${locationText}`));

    detail.appendChild(infoContainer);

    // 状态行（第二行：居中显示状态）
    const statusRow = createElement('div', '', {
        style: 'display: flex; justify-content: center; margin-top: 4px;'
    });

    if (schedule.isMerged) {
        // Merged state: do not show count badge as per user request
        // Leave empty or show something else? User said "delete".
    }

    // Single item status row is redundant if we show status inline, but keeping it for consistency or maybe remove?
    // The statusRow is created but not appended anywhere.
    // The original code had an `else` block with `return detail;` which was incorrect.
    // The `return detail;` should be at the end of the function.
    return detail;
}

function renderHeader(weekDates) {
    const thead = elements.header();
    if (!thead) return;
    clearChildren(thead);

    const row = document.createElement('tr');
    weekDates.forEach(date => {
        const iso = toISODate(date);
        const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        const weekday = weekdayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
        const label = `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}\n${weekday}`;
        const th = createElement('th', '', { textContent: label });
        th.dataset.date = iso;
        row.appendChild(th);
    });
    thead.appendChild(row);
}

function renderBody(weekDates, grouped) {
    const tbody = elements.body();
    if (!tbody) return;
    clearChildren(tbody);

    const row = document.createElement('tr');
    weekDates.forEach(date => {
        const iso = toISODate(date);
        const cell = createElement('td', 'schedule-cell');

        // Date label for mobile
        const day = date.getDate();
        const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdayNames[date.getDay()];
        const dateLabel = `${day}/${weekday}`;
        cell.setAttribute('data-date-label', dateLabel);

        const dailySchedules = grouped.get(iso) || [];
        if (dailySchedules.length === 0) {
            const empty = createElement('div', 'no-schedule', { textContent: '暂无排课' });
            cell.appendChild(empty);
        } else {
            dailySchedules.forEach(schedule => {
                cell.appendChild(buildScheduleCard(schedule));
            });
        }
        row.appendChild(cell);
    });
    tbody.appendChild(row);
}

function buildScheduleCard(schedule) {
    const status = (schedule.status || 'pending').toLowerCase();
    const displayStatus = getDisplayStatus(schedule);
    const slotId = getTimeSlotId(schedule.start_time);

    // Use Admin-like structure: group-picker-item
    const card = createElement('div', `group-picker-item slot-${slotId} status-${status} schedule-card`);
    card.dataset.scheduleId = schedule.id;
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '4px';

    // 构建显示文本
    // 格式：张老师（入户，已确认），周老师（入户，已确认），19:00-21:00，新课堂5楼
    const teachers = schedule.teachers || [{
        name: schedule.teacher_name || '未分配教师',
        type: schedule.schedule_type_cn || schedule.schedule_type || '课程',
        status: schedule.status
    }];

    const textContainer = createElement('div', '', {
        style: 'font-size: 13px; line-height: 1.8; word-break: break-word;'
    });

    teachers.forEach((t, index) => {
        // Teacher Name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = t.name;
        textContainer.appendChild(nameSpan);

        textContainer.appendChild(document.createTextNode(' ('));

        // Type Chip
        let typeClass = 'type-default';
        if (t.type.includes('入户')) typeClass = 'type-visit';
        else if (t.type.includes('试教')) typeClass = 'type-trial';
        else if (t.type.includes('评审')) typeClass = 'type-review';
        else if (t.type.includes('半次')) typeClass = 'type-half-visit';
        else if (t.type.includes('集体')) typeClass = 'type-group-activity';

        const typeChip = createElement('span', `chip ${typeClass}`, {
            textContent: t.type,
            style: 'font-size: 11px; padding: 1px 6px; border-radius: 4px; margin: 0 2px; vertical-align: middle;'
        });
        textContainer.appendChild(typeChip);

        textContainer.appendChild(document.createTextNode(', '));

        // Status Chip
        const displayStatus = getDisplayStatus({ status: t.status });
        const statusChip = createElement('span', `chip status-${t.status}`, {
            textContent: displayStatus,
            style: 'font-size: 11px; padding: 1px 6px; border-radius: 4px; margin: 0 2px; vertical-align: middle;'
        });
        textContainer.appendChild(statusChip);

        textContainer.appendChild(document.createTextNode(')'));

        if (index < teachers.length - 1) {
            textContainer.appendChild(document.createTextNode(', '));
        }
    });

    const timeText = formatTimeRange(schedule.start_time, schedule.end_time);
    const locationText = schedule.location || '上课地点未确定';

    textContainer.appendChild(document.createTextNode(`, ${timeText}, ${locationText}`));

    card.appendChild(textContainer);

    // Action Button or Merged Info
    if (schedule.isMerged) {
        // User requested to remove the count badge for merged items
    } else if (status === 'pending') {
        const actionRow = createElement('div', '', { style: 'display: flex; justify-content: flex-end; margin-top: 4px;' });
        const confirmBtn = createElement('button', 'btn small-btn primary-btn', {
            textContent: '确认'
        });
        confirmBtn.style.cssText = 'padding: 2px 8px; font-size: 12px; border-radius: 4px;';
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleConfirmSchedule(schedule.id);
        });
        actionRow.appendChild(confirmBtn);
        card.appendChild(actionRow);
    }

    return card;
}

async function handleConfirmSchedule(scheduleId) {
    try {
        const response = await fetch(`${API_ENDPOINTS.CONFIRM_SCHEDULE}/${scheduleId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('确认课程失败');
        }

        showInlineFeedback(elements.feedback(), '课程确认成功', 'success');
        // Refresh schedules to update UI
        loadSchedules(currentWeekStart);
    } catch (error) {
        handleApiError(error, '确认课程失败');
    }
}

function renderEmptyState(message) {
    renderHeader([]);
    const tbody = elements.body();
    if (!tbody) return;
    clearChildren(tbody);
    const row = document.createElement('tr');
    const cell = createElement('td', 'no-schedule', { textContent: message });
    cell.colSpan = 7;
    row.appendChild(cell);
    tbody.appendChild(row);
}

function showLoadingState() {
    const tbody = elements.body();
    if (!tbody) return;
    clearChildren(tbody);
    const row = document.createElement('tr');
    const cell = createElement('td', 'no-schedule', { textContent: '加载中...' });
    cell.colSpan = 7;
    row.appendChild(cell);
    tbody.appendChild(row);
}

function updateWeekRangeLabel(weekDates) {
    const labelEl = elements.rangeLabel();
    if (!labelEl || weekDates.length === 0) return;
    setText(labelEl, formatWeekRangeText(weekDates[0], weekDates[weekDates.length - 1]));
}

export function refreshSchedules() {
    return loadSchedules(currentWeekStart);
}

function getDisplayStatus(schedule) {
    const status = (schedule.status || '').toLowerCase();
    const statusMap = {
        'pending': '待确认',
        'confirmed': '已确认',
        'completed': '已完成',
        'cancelled': '已取消'
    };

    return statusMap[status] || STATUS_LABELS[status] || status;
}
