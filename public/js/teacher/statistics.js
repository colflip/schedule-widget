/**
 * Teacher Statistics Section
 * Handles the statistics section with date range filtering and data visualization
 */

let statsChart = null;
let currentStatsData = [];

/**
 * Initialize the statistics section
 */
export async function initStatisticsSection() {
    setupDateRangePickers();
    setupEventListeners();
    await loadStatistics();
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
 * Apply date preset
 */
function applyDatePreset(type) {
    const now = new Date();
    let start, end;

    switch (type) {
        case 'last-week': {
            // Find last week's Monday
            const dayOfWeek = now.getDay() || 7; // 1 (Mon) - 7 (Sun)
            const daysToLastMonday = dayOfWeek + 6;
            start = new Date(now);
            start.setDate(now.getDate() - daysToLastMonday);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            break;
        }
        case 'last-month': {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        }
        case 'last-quarter': {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            let targetQuarter = currentQuarter - 1;
            let targetYear = now.getFullYear();

            if (targetQuarter < 0) {
                targetQuarter = 3;
                targetYear -= 1;
            }

            start = new Date(targetYear, targetQuarter * 3, 1);
            end = new Date(targetYear, (targetQuarter + 1) * 3, 0);
            break;
        }
        case 'last-year': {
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31);
            break;
        }
    }

    if (start && end) {
        const startDateInput = document.getElementById('teachingStartDate');
        const endDateInput = document.getElementById('teachingEndDate');
        if (startDateInput) startDateInput.value = formatDate(start);
        if (endDateInput) endDateInput.value = formatDate(end);
    }
}

/**
 * Setup event listeners for buttons
 */
function setupEventListeners() {
    const queryBtn = document.getElementById('teachingQueryBtn');


    if (queryBtn) {
        queryBtn.addEventListener('click', async () => {
            await loadStatistics();
        });
    }

    // Preset Buttons Logic
    const presets = [
        { id: 'btnLastWeek', type: 'last-week' },
        { id: 'btnLastMonth', type: 'last-month' },
        { id: 'btnLastQuarter', type: 'last-quarter' },
        { id: 'btnLastYear', type: 'last-year' }
    ];

    presets.forEach(preset => {
        const btn = document.getElementById(preset.id);
        if (btn) {
            btn.addEventListener('click', async () => {
                applyDatePreset(preset.type);
                await loadStatistics();
            });
        }
    });


}

/**
 * Load statistics data and render chart
 */
export async function loadStatistics() {
    const startDate = document.getElementById('teachingStartDate')?.value;
    const endDate = document.getElementById('teachingEndDate')?.value;

    if (!startDate || !endDate) {
        console.error('请选择日期范围');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `/api/teacher/detailed-schedules?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('获取统计数据失败');
        }

        const data = await response.json();
        // Transform detailed schedule objects to the shape expected by the chart logic
        const transformed = (Array.isArray(data) ? data : []).map(item => ({
            lesson_date: item.date,
            student_name: item.student_name,
            course_type: item.schedule_type || item.schedule_type_name,
            time_slot: `${item.start_time}-${item.end_time}`,
            status: item.status
        }));
        currentStatsData = transformed;
        renderChart(currentStatsData, startDate, endDate);
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

/**
 * Render the statistics chart
 */
function renderChart(schedules, startDate, endDate) {
    const chartCanvas = document.getElementById('teacherStatsChart');
    if (!chartCanvas) return;

    // Process data: group by date and course type
    const dateRange = getDateRange(new Date(startDate), new Date(endDate));
    const courseTypes = [...new Set(schedules.map(s => s.course_type || '其他'))];

    // Create datasets for each course type
    const datasets = courseTypes.map((type, index) => {
        const color = getColorForType(index);
        const data = dateRange.map(date => {
            return schedules.filter(s =>
                s.lesson_date === date && (s.course_type || '其他') === type
            ).length;
        });

        return {
            label: type,
            data: data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1
        };
    });

    // Destroy previous chart if exists
    if (statsChart) {
        statsChart.destroy();
    }

    // Create new chart
    const ctx = chartCanvas.getContext('2d');
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dateRange.map(date => formatDateLabel(date)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                title: {
                    display: true,
                    text: '授课统计',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: '日期'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '课程数量'
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/**
 * Get array of dates between start and end
 */
function getDateRange(startDate, endDate) {
    const dates = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        dates.push(formatDate(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
}

/**
 * Format date label for chart (MM/DD)
 */
function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

/**
 * Get color for course type by index
 */
function getColorForType(index) {
    const colors = [
        'rgba(59, 130, 246, 0.8)',   // Blue
        'rgba(16, 185, 129, 0.8)',   // Green
        'rgba(245, 158, 11, 0.8)',   // Amber
        'rgba(239, 68, 68, 0.8)',    // Red
        'rgba(139, 92, 246, 0.8)',   // Purple
        'rgba(236, 72, 153, 0.8)',   // Pink
        'rgba(14, 165, 233, 0.8)',   // Sky
        'rgba(34, 197, 94, 0.8)',    // Emerald
    ];
    return colors[index % colors.length];
}

/**
 * Export statistics data to CSV
 */


/**
 * Get status label in Chinese
 */
function getStatusLabel(status) {
    const statusMap = {
        'confirmed': '已确认',
        'pending': '待确认',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status || '未知';
}
