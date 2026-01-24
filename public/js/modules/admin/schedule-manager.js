/**
 * Schedule Manager Module
 * @description 处理排课管理相关的逻辑：周视图渲染、数据加载、排课增删改
 */

import { TIME_ZONE } from './constants.js';

// --- Helpers & Utils ---

function toISODate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function sanitizeTimeString(t) {
    if (t == null) return null;
    let s = String(t).trim();
    s = s.replace(/：/g, ':');
    const m = /^([0-2]?\d):([0-5]\d)(?::([0-5]\d))?$/.exec(s);
    if (m) {
        return `${String(m[1]).padStart(2, '0')}:${String(m[2]).padStart(2, '0')}`;
    }
    const m2 = /^([0-2]?\d)\s*[时点]\s*([0-5]?\d)\s*[分]?$/.exec(s);
    if (m2) {
        return `${String(m2[1]).padStart(2, '0')}:${String(m2[2]).padStart(2, '0')}`;
    }
    return null;
}

function normalizeScheduleRows(rows) {
    return (rows || []).map(r => {
        const rawDate = (r && (r.date ?? r.class_date ?? r['class-date'] ?? r.arr_date));
        let dateISO = '';
        if (rawDate) {
            const d = new Date(rawDate);
            dateISO = Number.isNaN(d.getTime()) ? (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '') : toISODate(d);
        }

        const start = sanitizeTimeString(r.start_time || r.startTime);
        const end = sanitizeTimeString(r.end_time || r.endTime);
        const typeId = (r.course_id ?? r.type_id ?? r.schedule_type_id);

        let typeText = r.schedule_type_cn || r.schedule_types || r.schedule_type || '';
        try {
            if (typeId != null && window.ScheduleTypesStore && window.ScheduleTypesStore.getById) {
                const info = window.ScheduleTypesStore.getById(typeId);
                if (info && !r.schedule_type_cn) typeText = info.description || info.name || typeText;
            }
        } catch (_) { }

        return {
            id: r.id,
            student_id: r.student_id,
            student_name: r.student_name,
            teacher_id: r.teacher_id,
            teacher_name: r.teacher_name || r.teacherName || '',
            course_id: typeId ? Number(typeId) : undefined,
            schedule_types: typeText,
            schedule_type_cn: r.schedule_type_cn,
            date: dateISO,
            start_time: start,
            end_time: end,
            location: (r.location || '').trim(),
            status: r.status,
            startMin: start ? (Number(start.split(':')[0]) * 60 + Number(start.split(':')[1])) : NaN,
            endMin: end ? (Number(end.split(':')[0]) * 60 + Number(end.split(':')[1])) : NaN
        };
    });
}

// --- Data Store ---

export const WeeklyDataStore = {
    ttlMs: 5 * 60 * 1000,
    students: { list: [], loadedAt: 0 },
    teachers: { list: [], loadedAt: 0 },
    schedules: new Map(),

    _isFresh(ts) { return ts && (Date.now() - ts) < this.ttlMs; },

    async getStudents(force = false) {
        if (!force && this._isFresh(this.students.loadedAt) && this.students.list.length) return this.students.list;
        const resp = await window.apiUtils.get('/admin/users/student');
        const list = Array.isArray(resp) ? resp : (resp && resp.data ? resp.data : []);
        this.students.list = list;
        this.students.loadedAt = Date.now();
        return list;
    },

    async getTeachers(force = false) {
        if (!force && this._isFresh(this.teachers.loadedAt) && this.teachers.list.length) return this.teachers.list;
        const resp = await window.apiUtils.get('/admin/users/teacher');
        let list = [];
        if (Array.isArray(resp)) list = resp;
        else if (resp && resp.data) list = resp.data;
        else if (resp && resp.teachers) list = resp.teachers;
        this.teachers.list = list;
        this.teachers.loadedAt = Date.now();
        return list;
    },

    async getSchedules(startDate, endDate, status, type, teacherId, force = false) {
        const key = `${startDate}|${endDate}|${status}|${type}|${teacherId}`;
        const cached = this.schedules.get(key);
        if (!force && cached && this._isFresh(cached.loadedAt)) return cached.rows;

        const params = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (status) params.status = status;
        if (type) params.course_id = type;
        if (teacherId) params.teacher_id = teacherId;

        try {
            const rows = await window.apiUtils.get('/admin/schedules/grid', params);
            const normalized = normalizeScheduleRows(Array.isArray(rows) ? rows : []);
            this.schedules.set(key, { rows: normalized, loadedAt: Date.now() });
            return normalized;
        } catch (err) {
            console.warn('Load schedules failed', err);
            return [];
        }
    },

    invalidateSchedules() { this.schedules.clear(); }
};

window.WeeklyDataStore = WeeklyDataStore;

// --- Main Logic ---

export async function loadSchedules() {
    try {
        renderWeeklyLoading();
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        let startDateISO, endDateISO, weekDates;
        const DRU = window.DateRangeUtils;

        if (startInput && endInput && startInput.value && endInput.value) {
            startDateISO = startInput.value;
            endDateISO = endInput.value;
            weekDates = buildDatesArray(startDateISO, endDateISO);
        } else if (window.__weeklyRange && window.__weeklyRange.start) {
            startDateISO = window.__weeklyRange.start;
            endDateISO = window.__weeklyRange.end;
            weekDates = buildDatesArray(startDateISO, endDateISO);
        } else {
            if (DRU) {
                weekDates = DRU.getWeekDates(new Date());
                startDateISO = toISODate(weekDates[0]);
                endDateISO = toISODate(weekDates[6]);
            } else {
                const d = new Date();
                weekDates = [d]; startDateISO = toISODate(d); endDateISO = startDateISO;
            }
            window.__weeklyRange = { start: startDateISO, end: endDateISO };
        }

        if (DRU && document.getElementById('weekRange')) {
            DRU.updateRangeText({ start: startDateISO, end: endDateISO, el: document.getElementById('weekRange') });
        }

        const type = document.getElementById('typeFilter')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const teacherId = document.getElementById('teacherFilter')?.value || '';
        const force = !!window.__weeklyForceRefresh || !!(type || status || teacherId);

        const students = await WeeklyDataStore.getStudents(force);
        const schedules = await WeeklyDataStore.getSchedules(startDateISO, endDateISO, status, type, teacherId, force);
        window.__weeklyForceRefresh = false;

        renderWeeklyHeader(weekDates);
        renderWeeklyBody(students, schedules, weekDates);

    } catch (err) {
        console.error('Load schedules error', err);
        renderWeeklyError(err.message);
    }
}

// --- Rendering ---

function buildDatesArray(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const dates = [];
    while (s <= e) {
        dates.push(new Date(s));
        s.setDate(s.getDate() + 1);
    }
    return dates;
}

function renderWeeklyLoading() {
    const tbody = document.getElementById('weeklyBody');
    if (tbody) tbody.innerHTML = '<tr><td class="sticky-col">加载中...</td><td colspan="7">请稍候</td></tr>';
}

function renderWeeklyError(msg) {
    const tbody = document.getElementById('weeklyBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8">错误: ${msg || '加载失败'}</td></tr>`;
}

function renderWeeklyHeader(weekDates) {
    const thead = document.getElementById('weeklyHeader');
    if (!thead) return;
    thead.innerHTML = '';
    const tr = document.createElement('tr');
    tr.innerHTML = '<th class="sticky-col student-cell">学生</th>';

    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    weekDates.forEach(d => {
        const th = document.createElement('th');
        const iso = toISODate(d);
        const dayName = days[d.getDay()];
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        th.innerHTML = `<div>${dateStr}</div><div style="font-size:0.85em;color:#64748b">${dayName}</div>`;
        th.dataset.date = iso;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
}

function renderWeeklyBody(students, schedules, weekDates) {
    const tbody = document.getElementById('weeklyBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const dateKeys = weekDates.map(toISODate);

    const cellIndex = new Map();
    const push = (sid, iso, row) => {
        const k = `${sid}|${iso}`;
        if (!cellIndex.has(k)) cellIndex.set(k, []);
        cellIndex.get(k).push(row);
    };

    schedules.forEach(s => {
        const iso = (typeof s.date === 'string') ? s.date : toISODate(new Date(s.date));
        if (s.student_id) push(s.student_id, iso, s);
        else if (s.student_ids) {
            String(s.student_ids).split(',').map(x => x.trim()).filter(Boolean).forEach(id => push(id, iso, s));
        }
    });

    students.forEach(student => {
        const tr = document.createElement('tr');
        tr.dataset.studentId = student.id;

        const nameTd = document.createElement('td');
        nameTd.textContent = student.name;
        nameTd.className = 'sticky-col student-cell';
        if (student.status == 0) {
            nameTd.classList.add('paused');
            nameTd.title = '该学生处于暂停状态';
        }
        tr.appendChild(nameTd);

        dateKeys.forEach(dateKey => {
            const td = document.createElement('td');
            td.className = 'schedule-cell';
            td.dataset.date = dateKey;

            const items = cellIndex.get(`${student.id}|${dateKey}`) || [];
            if (items.length === 0) {
                td.innerHTML = '<div class="no-schedule">暂无排课</div>';
            } else {
                renderGroupedMergedSlots(td, items, student, dateKey);
            }
            td.addEventListener('click', (e) => {
                if (student.status == 0 || student.status == -1) {
                    if (window.apiUtils) window.apiUtils.showToast('该学生状态异常，无法排课', 'warning');
                    return;
                }
                openCellEditor({ id: student.id, name: student.name, visit_location: student.visit_location }, dateKey);
            });
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function renderGroupedMergedSlots(td, items, student, dateKey) {
    const groups = new Map();
    items.forEach(item => {
        const loc = (item.location || '').trim();
        const start = item.start_time ? item.start_time.substring(0, 5) : '';
        const end = item.end_time ? item.end_time.substring(0, 5) : '';
        const key = `${start}|${end}|${loc}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });

    const sortedGroups = Array.from(groups.values()).sort((a, b) => (a[0].startMin || 0) - (b[0].startMin || 0));

    sortedGroups.forEach(group => {
        const card = buildAdminScheduleCard(group, student, dateKey);
        td.appendChild(card);
    });
}

function buildAdminScheduleCard(group, student, dateKey) {
    if (!group.length) return document.createElement('div');
    const first = group[0];

    let bgClass = 'bg-default';
    const h = parseInt((first.start_time || '00:00').substring(0, 2), 10);
    if (h < 12) bgClass = 'bg-morning';
    else if (h < 18) bgClass = 'bg-afternoon';
    else bgClass = 'bg-evening';

    const card = document.createElement('div');
    card.classList.add('schedule-card-group', bgClass);

    const listDiv = document.createElement('div');
    listDiv.className = 'schedule-list';

    group.forEach(rec => {
        const row = document.createElement('div');
        row.className = 'schedule-row';
        row.title = '点击修改';

        row.addEventListener('click', (e) => {
            e.stopPropagation();
            editSchedule(rec.id);
        });

        const left = document.createElement('div');
        left.className = 'row-left';
        left.innerHTML = `<span class="teacher-name">${rec.teacher_name || '未分配'}</span><span class="course-type-inline">(${rec.schedule_type_cn || rec.schedule_types || ''})</span>`;
        row.appendChild(left);

        const st = (rec.status || 'pending').toLowerCase();
        const badge = document.createElement('span');
        badge.className = `status-badge-sm ${st}`;
        const statusMap = { 'pending': '待确认', 'confirmed': '已确认', 'completed': '已完成', 'cancelled': '已取消' };
        badge.textContent = statusMap[st] || st;

        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const newStatus = prompt(`修改状态 (当前: ${statusMap[st]})\n请输入: pending, confirmed, completed, cancelled`, st);
            if (newStatus && ['pending', 'confirmed', 'completed', 'cancelled'].includes(newStatus) && newStatus !== st) {
                updateScheduleStatus(rec.id, newStatus);
            }
        });

        row.appendChild(badge);
        listDiv.appendChild(row);
    });

    card.appendChild(listDiv);

    const footer = document.createElement('div');
    footer.className = 'schedule-footer';
    footer.innerHTML = `<div class="time-range">${first.start_time}-${first.end_time}</div><div class="location-text">${first.location || ''}</div>`;
    card.appendChild(footer);

    return card;
}

// --- Status & Edit Logic ---

export async function updateScheduleStatus(id, newStatus) {
    if (!window.apiUtils) return;
    try {
        await window.apiUtils.put(`/admin/schedules/${id}`, { status: newStatus });
        window.apiUtils.showSuccessToast('状态已更新');

        for (const entry of WeeklyDataStore.schedules.values()) {
            if (entry.rows) {
                const t = entry.rows.find(r => String(r.id) == String(id));
                if (t) t.status = newStatus;
            }
        }

        const section = document.getElementById('schedule');
        if (section && section.classList.contains('active')) {
            loadSchedules();
        }
    } catch (err) {
        console.error(err);
        window.apiUtils.showToast('更新状态失败', 'error');
    }
}

export async function deleteSchedule(id) {
    if (!confirm('确定要删除此排课吗？')) return;
    try {
        await window.apiUtils.delete(`/admin/schedules/${id}`);
        window.apiUtils.showSuccessToast('删除成功');
        document.getElementById('scheduleFormContainer').style.display = 'none';
        WeeklyDataStore.invalidateSchedules();
        loadSchedules();
    } catch (e) {
        console.error(e);
        window.apiUtils.showToast('删除失败: ' + e.message, 'error');
    }
}

function openCellEditor(student, dateISO) {
    const form = document.getElementById('scheduleForm');
    const container = document.getElementById('scheduleFormContainer');
    if (!form || !container) return;

    loadScheduleFormOptions().then(() => {
        form.dataset.mode = 'add';
        form.dataset.id = '';
        document.getElementById('scheduleFormTitle').textContent = '添加排课';

        const delBtn = document.getElementById('scheduleFormDelete');
        if (delBtn) delBtn.style.display = 'none';

        const studentSel = form.querySelector('#scheduleStudent');
        const studentReadonlyDiv = document.getElementById('scheduleStudentReadonly');
        const dateInput = form.querySelector('#scheduleDate');
        const dateReadonlyDiv = document.getElementById('scheduleDateReadonly');

        if (studentSel) {
            studentSel.value = String(student.id);
            studentSel.disabled = true;
            studentSel.style.display = 'none';
        }
        if (studentReadonlyDiv) {
            studentReadonlyDiv.textContent = student.name || String(student.id);
            studentReadonlyDiv.style.display = 'block';
        }

        if (dateInput) {
            dateInput.value = dateISO;
            dateInput.disabled = true;
            dateInput.style.display = 'none';
        }
        if (dateReadonlyDiv) {
            dateReadonlyDiv.textContent = dateISO;
            dateReadonlyDiv.style.display = 'block';
        }

        form.querySelector('#scheduleStartTime').value = '19:00';
        form.querySelector('#scheduleEndTime').value = '22:00';
        form.querySelector('#scheduleLocation').value = student.visit_location || '';
        if (form.querySelector('#scheduleStatus')) form.querySelector('#scheduleStatus').value = 'confirmed';

        container.style.display = 'block';
    });
}

export async function editSchedule(id) {
    const container = document.getElementById('scheduleFormContainer');
    const form = document.getElementById('scheduleForm');
    if (!container || !form) return;

    try {
        const [_, resp] = await Promise.all([
            loadScheduleFormOptions(),
            window.apiUtils.get(`/admin/schedules/${id}`)
        ]);
        const data = resp.data || resp;

        form.dataset.mode = 'edit';
        form.dataset.id = id;
        document.getElementById('scheduleFormTitle').textContent = '编辑排课';

        const delBtn = document.getElementById('scheduleFormDelete');
        if (delBtn) {
            delBtn.style.display = 'inline-block';
            const newDel = delBtn.cloneNode(true);
            delBtn.parentNode.replaceChild(newDel, delBtn);
            newDel.className = 'btn btn-danger';
            newDel.textContent = '删除';
            newDel.addEventListener('click', () => deleteSchedule(id));
        }

        const studentSel = form.querySelector('#scheduleStudent');
        const studentReadonlyDiv = document.getElementById('scheduleStudentReadonly');
        const dateInput = form.querySelector('#scheduleDate');
        const dateReadonlyDiv = document.getElementById('scheduleDateReadonly');

        if (studentSel) { studentSel.disabled = false; studentSel.style.display = 'block'; studentSel.value = data.student_id; }
        if (studentReadonlyDiv) studentReadonlyDiv.style.display = 'none';

        if (dateInput) {
            let iso = data.date;
            if (data.class_date) iso = data.class_date;
            if (iso && iso.length > 10) iso = iso.substring(0, 10);
            dateInput.disabled = false; dateInput.style.display = 'block'; dateInput.value = iso;
        }
        if (dateReadonlyDiv) dateReadonlyDiv.style.display = 'none';

        form.querySelector('#scheduleTeacher').value = data.teacher_id || '';
        form.querySelector('#scheduleStartTime').value = sanitizeTimeString(data.start_time);
        form.querySelector('#scheduleEndTime').value = sanitizeTimeString(data.end_time);
        form.querySelector('#scheduleLocation').value = data.location || '';
        form.querySelector('#scheduleTypeSelect').value = data.course_id || '';
        if (form.querySelector('#scheduleStatus')) form.querySelector('#scheduleStatus').value = data.status || 'pending';

        container.style.display = 'block';
        form.dataset.snapshot = JSON.stringify(data);

    } catch (err) {
        console.error('Fetch schedule details failed', err);
        window.apiUtils.showToast('加载详情失败', 'error');
    }
}

async function loadScheduleFormOptions() {
    const typeSel = document.getElementById('scheduleTypeSelect');
    if (typeSel && window.ScheduleTypesStore) {
        const types = window.ScheduleTypesStore.getAll();
        typeSel.innerHTML = '<option value="">选择类型</option>';
        types.forEach(t => {
            const o = document.createElement('option');
            o.value = t.id; o.textContent = t.description || t.name;
            typeSel.appendChild(o);
        });
    }

    const teacherSel = document.getElementById('scheduleTeacher');
    const studentSel = document.getElementById('scheduleStudent');

    const [teachers, students] = await Promise.all([WeeklyDataStore.getTeachers(), WeeklyDataStore.getStudents()]);

    if (teacherSel) {
        teacherSel.innerHTML = '<option value="">选择教师</option>';
        teachers.forEach(t => {
            if (String(t.status) == '-1') return;
            const o = document.createElement('option');
            o.value = t.id; o.textContent = t.name + (String(t.status) == '0' ? '(暂停)' : '');
            teacherSel.appendChild(o);
        });
    }
    if (studentSel) {
        studentSel.innerHTML = '<option value="">选择学生</option>';
        students.forEach(s => {
            if (String(s.status) == '-1') return;
            const o = document.createElement('option');
            o.value = s.id; o.textContent = s.name + (String(s.status) == '0' ? '(暂停)' : '');
            studentSel.appendChild(o);
        });
    }
}

export async function setupScheduleEventListeners() {
    const form = document.getElementById('scheduleForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('scheduleFormSubmit');
            const mode = form.dataset.mode;
            const id = form.dataset.id;

            const body = {
                student_id: form.querySelector('#scheduleStudent').value,
                teacher_id: form.querySelector('#scheduleTeacher').value || null,
                date: form.querySelector('#scheduleDate').value,
                start_time: form.querySelector('#scheduleStartTime').value,
                end_time: form.querySelector('#scheduleEndTime').value,
                location: form.querySelector('#scheduleLocation').value,
                course_id: form.querySelector('#scheduleTypeSelect').value || null,
                status: form.querySelector('#scheduleStatus') ? form.querySelector('#scheduleStatus').value : 'confirmed'
            };

            if (!body.student_id || !body.date || !body.start_time || !body.end_time) {
                if (window.apiUtils) window.apiUtils.showToast('请填写必填项', 'error');
                return;
            }

            if (btn) btn.disabled = true;
            try {
                if (mode === 'add') {
                    await window.apiUtils.post('/admin/schedules', body);
                    window.apiUtils.showSuccessToast('排课已添加');
                } else {
                    await window.apiUtils.put(`/admin/schedules/${id}`, body);
                    window.apiUtils.showSuccessToast('排课已更新');
                }
                document.getElementById('scheduleFormContainer').style.display = 'none';
                WeeklyDataStore.invalidateSchedules();
                loadSchedules();
            } catch (err) {
                console.error(err);
                if (window.apiUtils) window.apiUtils.showToast('保存失败: ' + (err.message || ''), 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    // Week Nav
    const prevBtn = document.getElementById('prevWeek');
    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (!window.__weeklyRange) return;
        const s = new Date(window.__weeklyRange.start);
        s.setDate(s.getDate() - 7);
        const e = new Date(s); e.setDate(e.getDate() + 6);
        window.__weeklyRange.start = toISODate(s);
        window.__weeklyRange.end = toISODate(e);
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');
        if (startInput) startInput.value = window.__weeklyRange.start;
        if (endInput) endInput.value = window.__weeklyRange.end;
        loadSchedules();
    });
    const nextBtn = document.getElementById('nextWeek');
    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (!window.__weeklyRange) return;
        const s = new Date(window.__weeklyRange.start);
        s.setDate(s.getDate() + 7);
        const e = new Date(s); e.setDate(e.getDate() + 6);
        window.__weeklyRange.start = toISODate(s);
        window.__weeklyRange.end = toISODate(e);
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');
        if (startInput) startInput.value = window.__weeklyRange.start;
        if (endInput) endInput.value = window.__weeklyRange.end;
        loadSchedules();
    });
    const todayBtn = document.getElementById('todayWeek');
    if (todayBtn) todayBtn.addEventListener('click', () => {
        const DRU = window.DateRangeUtils;
        if (DRU) {
            const week = DRU.getWeekDates(new Date());
            window.__weeklyRange = { start: toISODate(week[0]), end: toISODate(week[6]) };
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');
            if (startInput) startInput.value = window.__weeklyRange.start;
            if (endInput) endInput.value = window.__weeklyRange.end;
            loadSchedules();
        }
    });

    // Date Range Pickers
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    if (startInput) startInput.addEventListener('change', () => {
        window.__weeklyRange = { start: startInput.value, end: endInput.value };
        loadSchedules();
    });
    if (endInput) endInput.addEventListener('change', () => {
        window.__weeklyRange = { start: startInput.value, end: endInput.value };
        loadSchedules();
    });

    // Filter changes
    ['typeFilter', 'statusFilter', 'teacherFilter'].forEach(fid => {
        const el = document.getElementById(fid);
        if (el) el.addEventListener('change', () => {
            window.__weeklyForceRefresh = true;
            loadSchedules();
        });
    });

    initScheduleFilters();
}

async function initScheduleFilters() {
    const tf = document.getElementById('teacherFilter');
    if (tf) {
        try {
            const teachers = await WeeklyDataStore.getTeachers();
            const current = tf.value;
            tf.innerHTML = '<option value="">全部教师</option>';
            teachers.forEach(t => {
                if (String(t.status) == '-1') return;
                const o = document.createElement('option');
                o.value = t.id; o.textContent = t.name;
                tf.appendChild(o);
            });
            if (current) tf.value = current;
        } catch (e) { console.warn('Init teacher filter failed', e); }
    }
}
