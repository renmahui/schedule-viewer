let courses = [];
let currentWeek = 1;
let showAllWeeks = false;
let studentInfo = {};
const START_DATE = new Date(2025, 2, 9);
const MAX_WEEK = 17;

const courseColors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
    '#dfe6e9', '#a29bfe', '#fd79a8', '#00b894', '#e17055',
    '#74b9ff', '#fdcb6e', '#e056fd', '#686de0', '#4834d4'
];

const colorMap = {};

function getCourseColor(courseName) {
    if (!colorMap[courseName]) {
        const index = Object.keys(colorMap).length % courseColors.length;
        colorMap[courseName] = courseColors[index];
    }
    return colorMap[courseName];
}

function isCourseInWeek(course, week) {
    const weekStr = course.weeks || '';
    if (showAllWeeks) return true;

    const oddWeek = weekStr.includes('(单)');
    const evenWeek = weekStr.includes('(双)');

    if (oddWeek) {
        return week % 2 === 1;
    }
    if (evenWeek) {
        return week % 2 === 0;
    }

    let weeks = [];
    const singleWeekMatches = weekStr.match(/(\d+)周/g);
    const rangeWeekMatches = weekStr.match(/(\d+)-(\d+)/g);

    if (singleWeekMatches) {
        singleWeekMatches.forEach(w => {
            const num = parseInt(w.replace('周', ''));
            if (!isNaN(num)) weeks.push(num);
        });
    }
    if (rangeWeekMatches) {
        rangeWeekMatches.forEach(w => {
            const [start, end] = w.split('-').map(Number);
            for (let i = start; i <= end; i++) weeks.push(i);
        });
    }

    weeks = [...new Set(weeks)];
    return weeks.includes(week);
}

function getDateForWeekday(week, weekday) {
    if (week < 1 || week > MAX_WEEK) return '';
    const weekStart = new Date(START_DATE);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7 + weekday);
    const month = weekStart.getMonth() + 1;
    const day = weekStart.getDate();
    return `${month}月${day}日`;
}

function initSchedule() {
    const scheduleBody = document.getElementById('scheduleBody');
    scheduleBody.innerHTML = '';

    for (let period = 1; period <= 8; period++) {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.dataset.period = period;

        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.innerHTML = `<span class="period">${period}</span><span class="section-label">节</span>`;
        timeSlot.appendChild(timeLabel);

        for (let day = 0; day < 7; day++) {
            const cell = document.createElement('div');
            cell.className = 'course-cell empty';
            cell.dataset.day = day;
            cell.dataset.period = period;
            timeSlot.appendChild(cell);
        }

        scheduleBody.appendChild(timeSlot);
    }
}

function renderSchedule() {
    if (courses.length === 0) return;

    document.querySelectorAll('.course-cell').forEach(cell => {
        cell.innerHTML = '';
        cell.className = 'course-cell empty';
        cell.onclick = null;
        cell.style.height = '';
        cell.style.display = '';
    });

    courses.forEach(course => {
        const dayMap = { '星期一': 0, '星期二': 1, '星期三': 2, '星期四': 3, '星期五': 4, '星期六': 5, '星期日': 6 };
        const day = dayMap[course.day];

        if (day === undefined) return;

        const sectionMatch = course.section.match(/(\d+)-(\d+)/);
        if (!sectionMatch) return;

        const startSection = parseInt(sectionMatch[1]);
        const endSection = parseInt(sectionMatch[2]);
        const span = endSection - startSection + 1;

        const isInWeek = isCourseInWeek(course, currentWeek);

        if (!showAllWeeks && !isInWeek) {
            return;
        }

        const color = getCourseColor(course.name);

        for (let s = startSection; s <= endSection; s++) {
            const cell = document.querySelector(`.course-cell[data-day="${day}"][data-period="${s}"]`);
            if (!cell) continue;

            const isFirstPeriod = (s === startSection);

            cell.className = 'course-cell has-course';
            if (!isInWeek) {
                cell.classList.add('week-dimmed');
            }

            if (isFirstPeriod) {
                if (span > 1) {
                    let totalHeight = 0;
                    for (let i = 0; i < span; i++) {
                        const slot = document.querySelector(`.time-slot[data-period="${startSection + i}"]`);
                        if (slot) {
                            totalHeight += slot.offsetHeight;
                        }
                    }
                    cell.style.height = (totalHeight - 8) + 'px';
                    cell.style.zIndex = '10';
                    cell.style.position = 'relative';
                }

                const courseItem = document.createElement('div');
                courseItem.className = 'course-item' + (span > 1 ? ' merged' : '');
                courseItem.style.backgroundColor = color;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'course-name';
                nameSpan.textContent = course.name;
                courseItem.appendChild(nameSpan);

                if (span === 1) {
                    const weeksSpan = document.createElement('span');
                    weeksSpan.className = 'course-weeks';
                    weeksSpan.textContent = course.weeks;
                    courseItem.appendChild(weeksSpan);
                }

                cell.appendChild(courseItem);
                cell.onclick = () => showCourseDetail(course);
            }
        }
    });
}

function updateDateDisplay() {
    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    document.querySelectorAll('.day-column').forEach((col, index) => {
        const date = getDateForWeekday(currentWeek, index);
        if (date) {
            col.textContent = `${weekdays[index]}\n${date}`;
        } else {
            col.textContent = weekdays[index];
        }
    });
}

function updateWeekDisplay() {
    const weekDisplay = document.getElementById('weekDisplay');
    const currentWeekSpan = document.getElementById('currentWeek');

    if (showAllWeeks) {
        weekDisplay.childNodes[0].textContent = '显示全部';
        if (currentWeekSpan) {
            currentWeekSpan.style.display = 'none';
        }
    } else {
        weekDisplay.childNodes[0].textContent = `第 `;
        if (currentWeekSpan) {
            currentWeekSpan.style.display = '';
            currentWeekSpan.textContent = currentWeek;
        }
    }
}

function showCourseDetail(course) {
    document.getElementById('detailName').textContent = course.name;
    document.getElementById('detailTime').textContent = `${course.day} 第${course.section}节`;
    document.getElementById('detailWeeks').textContent = course.weeks;
    document.getElementById('detailLocation').textContent = `${course.campus || ''} ${course.location || ''}`.trim();
    document.getElementById('detailTeacher').textContent = course.teacher || '未知';
    document.getElementById('detailCredit').textContent = course.credit || '未知';

    document.getElementById('courseDetail').classList.add('show');
}

function closeDetail() {
    document.getElementById('courseDetail').classList.remove('show');
}

function changeWeek(delta) {
    const newWeek = currentWeek + delta;
    if (newWeek >= 1 && newWeek <= MAX_WEEK) {
        currentWeek = newWeek;
        const currentWeekSpan = document.getElementById('currentWeek');
        if (currentWeekSpan) {
            currentWeekSpan.textContent = currentWeek;
        }
        updateDateDisplay();
        renderSchedule();
    }
}

function toggleAllWeeks() {
    const checkbox = document.getElementById('showAllWeeks');
    showAllWeeks = checkbox.checked;
    updateWeekDisplay();
    renderSchedule();
}

document.getElementById('pdfInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('fileName').textContent = file.name;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/parse-pdf', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.error) {
            alert('解析失败: ' + result.error);
            return;
        }

        courses = result.courses;
        Object.keys(colorMap).forEach(key => delete colorMap[key]);

        studentInfo = {
            name: result.student_name,
            id: result.student_id,
            semester: result.semester
        };

        document.getElementById('studentInfo').textContent =
            `${studentInfo.name || ''} ${studentInfo.id || ''} ${studentInfo.semester || ''}`.trim();

        currentWeek = 1;
        showAllWeeks = false;

        const checkbox = document.getElementById('showAllWeeks');
        checkbox.checked = false;

        const currentWeekSpan = document.getElementById('currentWeek');
        if (currentWeekSpan) {
            currentWeekSpan.textContent = currentWeek;
            currentWeekSpan.style.display = '';
        }

        initSchedule();
        updateDateDisplay();
        renderSchedule();

        alert(`成功导入 ${courses.length} 门课程！`);

    } catch (error) {
        alert('上传失败: ' + error.message);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    initSchedule();
    updateDateDisplay();
});

document.getElementById('courseDetail').addEventListener('click', function(e) {
    if (e.target === this) {
        closeDetail();
    }
});
