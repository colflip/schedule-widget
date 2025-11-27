/**
 * Student Statistics Module
 * Displays total learning count within a selected date range
 */

import { API_ENDPOINTS, STATUS_LABELS, SCHEDULE_TYPE_MAP } from './constants.js';
import { formatDateDisplay, handleApiError } from './utils.js';

let currentLearningData = null;
let dailyChartInstance = null;

/**
 * Initialize the statistics section
 */
export async function initStatisticsSection() {
    setupDateRangePickers();
    setupEventListeners();

    // Auto-load data when section is initialized
    console.log('[Statistics] Auto-loading initial data...');

    try {
        await loadLearningStats();
        console.log('[Statistics] Initial data loaded successfully');
    } catch (error) {
        console.error('[Statistics] Failed to auto-load data:', error);
        updateDisplay({ schedules: [], typeStats: {} });
    }
}

/**
 * Setup date range pickers with default values (current month)
 */
function setupDateRangePickers() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startDateInput = document.getElementById('teachingStartDate');
    const endDateInput = document.getElementById('teachingEndDate');

    if (startDateInput) {
        startDateInput.value = formatDate(firstDay);
    }
    if (endDateInput) {
        endDateInput.value = formatDate(lastDay);
    }
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Setup event listeners for buttons
 */
function setupEventListeners() {
    const queryBtn = document.getElementById('teachingQueryBtn');

    if (queryBtn) {
        queryBtn.addEventListener('click', async () => {
            // Show loading state
            queryBtn.disabled = true;
            const originalText = queryBtn.textContent;
            queryBtn.textContent = '加载中...';

            try {
                await loadLearningStats();
            } finally {
                queryBtn.disabled = false;
                queryBtn.textContent = originalText;
            }
        });
    }

    const exportBtn = document.getElementById('teachingExportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportLearningData);
    }
}

/**
 * Load learning data from API
 */
export async function loadLearningStats() {
    const startDate = document.getElementById('teachingStartDate')?.value;
    const endDate = document.getElementById('teachingEndDate')?.value;

    if (!startDate || !endDate) {
        console.error('请选择日期范围');
        return;
    }

    try {
        // Use schedules endpoint to get detailed data
        const response = await fetch(
            `${API_ENDPOINTS.SCHEDULES}?startDate=${startDate}&endDate=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('获取学习数据失败');
        }

        const data = await response.json();
        let schedules = Array.isArray(data) ? data : [];

        // Filter out cancelled courses
        schedules = schedules.filter(schedule => {
            const status = (schedule.status || '').toLowerCase();
            return status !== 'cancelled';
        });

        // Calculate stats by type
        const typeStats = {};
        schedules.forEach(schedule => {
            const typeCode = schedule.schedule_type || '';
            const type = schedule.schedule_type_cn || SCHEDULE_TYPE_MAP[typeCode] || typeCode || '其他';
            typeStats[type] = (typeStats[type] || 0) + 1;
        });

        currentLearningData = {
            schedules: schedules,
            typeStats: typeStats
        };

        updateDisplay(currentLearningData);
    } catch (error) {
        console.error('加载学习数据失败:', error);
        handleApiError(error, '加载学习统计失败');
        updateDisplay({ schedules: [], typeStats: {} });
    }
}

/**
 * Update the display with learning stats and detailed table
 */
function updateDisplay(data) {
    // Update type stats grid
    const statsGrid = document.getElementById('teachingTypeStats');
    if (statsGrid) {
        statsGrid.innerHTML = '';

        const types = Object.keys(data.typeStats);
        if (types.length === 0) {
            statsGrid.innerHTML = `
                <div class="type-stat-card">
                    <h3>总课程数</h3>
                    <div class="count-value">0</div>
                </div>
            `;
        } else {
            types.forEach(type => {
                const count = data.typeStats[type];
                const card = document.createElement('div');
                card.className = 'stat-card';
                card.innerHTML = `
                    <h3>${type}</h3>
                    <p>${count}</p>
                `;
                statsGrid.appendChild(card);
            });
        }
    }

    // Render daily chart
    renderDailyLearningChart(data.schedules);

    // Update details table
    const tbody = document.getElementById('teachingDetailsBody');
    if (tbody) {
        tbody.innerHTML = '';

        if (!data.schedules || data.schedules.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" style="text-align: center; padding: 20px; color: #888;">暂无学习记录</td>';
            tbody.appendChild(tr);
            return;
        }

        data.schedules.forEach(schedule => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateDisplay(schedule.date || schedule.lesson_date)}</td>
                <td>${schedule.start_time} - ${schedule.end_time}</td>
                <td>${schedule.schedule_type_cn || SCHEDULE_TYPE_MAP[schedule.schedule_type] || schedule.schedule_type || '--'}</td>
                <td>${schedule.teacher_name || '--'}</td>
                <td>${schedule.location || '--'}</td>
                <td>${STATUS_LABELS[schedule.status] || schedule.status}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

/**
 * Get color for course type
 */
function getLegendColor(name) {
    const LEGEND_COLOR_MAP = {
        '入户': '#3366CC',
        '试教': '#FF9933',
        '评审': '#7C4DFF',
        '评审记录': '#B39DDB',
        '心理咨询': '#33CC99',
        '线上辅导': '#0099C6',
        '线下辅导': '#5C6BC0',
        '集体活动': '#DC3912',
        '半次入户': '#4E79A7',
        '家访': '#8E8CD8',
        '其他': '#78909C',
        '未分类': '#9E9E9E'
    };

    const key = String(name || '').trim();
    if (key && LEGEND_COLOR_MAP[key]) {
        return LEGEND_COLOR_MAP[key];
    }

    for (const [typeKey, color] of Object.entries(LEGEND_COLOR_MAP)) {
        if (key.includes(typeKey) || typeKey.includes(key)) {
            return color;
        }
    }

    const hash = Array.from(key).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const fallbackPalette = [
        '#3366CC', '#FF9933', '#33CC99', '#DC3912', '#7C4DFF',
        '#0099C6', '#5C6BC0', '#66AA00', '#E91E63', '#00ACC1'
    ];
    return fallbackPalette[hash % fallbackPalette.length];
}

/**
 * Generate all dates in range
 */
function generateDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/**
 * Render daily learning chart
 */
function renderDailyLearningChart(schedules) {
    const canvas = document.getElementById('dailyTeachingChart');
    if (!canvas) return;

    if (dailyChartInstance) {
        dailyChartInstance.destroy();
        dailyChartInstance = null;
    }

    if (!schedules || schedules.length === 0) return;

    const startDate = document.getElementById('teachingStartDate')?.value;
    const endDate = document.getElementById('teachingEndDate')?.value;

    if (!startDate || !endDate) return;

    const allDates = generateDateRange(startDate, endDate);
    const dailyData = {};
    const allTypes = new Set();

    allDates.forEach(date => {
        dailyData[date] = {};
    });

    schedules.forEach(schedule => {
        let dateKey = schedule.date || schedule.lesson_date;
        if (dateKey) {
            try {
                if (dateKey.includes('T')) {
                    dateKey = dateKey.split('T')[0];
                } else {
                    const d = new Date(dateKey);
                    if (!isNaN(d.getTime())) {
                        dateKey = formatDate(d);
                    }
                }
            } catch (e) {
                console.warn('Date parsing error:', e);
            }
        }

        const typeCode = schedule.schedule_type || '';
        const type = schedule.schedule_type_cn || SCHEDULE_TYPE_MAP[typeCode] || typeCode || '未分类';

        if (dailyData[dateKey]) {
            if (!dailyData[dateKey][type]) {
                dailyData[dateKey][type] = 0;
            }
            dailyData[dateKey][type]++;
            allTypes.add(type);
        }
    });

    const types = Array.from(allTypes);
    const datasets = types.map((type) => {
        return {
            label: type,
            data: allDates.map(date => dailyData[date][type] || 0),
            backgroundColor: getLegendColor(type),
            borderColor: getLegendColor(type),
            borderWidth: 0,
            borderRadius: 4
        };
    });

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isSmallMobile = window.matchMedia('(max-width: 480px)').matches;

    const formatDateLabel = (dateStr, index, allDates) => {
        const current = new Date(dateStr + 'T00:00:00');
        const first = new Date(allDates[0] + 'T00:00:00');
        const last = new Date(allDates[allDates.length - 1] + 'T00:00:00');

        if (first.getFullYear() !== last.getFullYear()) {
            return `${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()}`;
        }
        if (first.getMonth() !== last.getMonth()) {
            return `${current.getMonth() + 1}-${current.getDate()}`;
        }
        return `${current.getDate()}`;
    };

    const ctx = canvas.getContext('2d');
    dailyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allDates.map((date, index) => formatDateLabel(date, index, allDates)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        font: { size: isSmallMobile ? 9 : (isMobile ? 10 : 11) },
                        maxRotation: isMobile ? 45 : 0,
                        minRotation: isMobile ? 45 : 0,
                        autoSkip: true,
                        maxTicksLimit: isSmallMobile ? 7 : (isMobile ? 10 : 15)
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: isSmallMobile ? 9 : (isMobile ? 10 : 11) } },
                    grid: { color: 'rgba(55,65,81,0.08)' }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 10,
                        padding: 15,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: (context) => `日期: ${context[0].label}`,
                        label: (context) => `${context.dataset.label}: ${context.parsed.y}次`,
                        footer: (context) => {
                            let sum = 0;
                            context.forEach(item => sum += item.parsed.y);
                            return `总计: ${sum}次`;
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

/**
 * Export learning data to CSV
 */
function exportLearningData() {
    if (!currentLearningData || !currentLearningData.schedules || currentLearningData.schedules.length === 0) {
        alert('没有可导出的数据');
        return;
    }

    const headers = ['日期', '时间段', '课程类型', '教师姓名', '上课地点', '状态'];
    const rows = currentLearningData.schedules.map(schedule => [
        formatDateDisplay(schedule.date || schedule.lesson_date),
        `${schedule.start_time} - ${schedule.end_time}`,
        schedule.schedule_type_cn || SCHEDULE_TYPE_MAP[schedule.schedule_type] || schedule.schedule_type || '--',
        schedule.teacher_name || '--',
        schedule.location || '--',
        STATUS_LABELS[schedule.status] || schedule.status
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `学习记录_${formatDate(new Date())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
