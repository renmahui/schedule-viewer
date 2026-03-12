from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import pdfplumber
import re
import os
import uuid

app = Flask(__name__, template_folder='../templates', static_folder='../static')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

UPLOAD_FOLDER = '/tmp'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class Course:
    def __init__(self):
        self.name = ""
        self.time_period = ""
        self.weeks = ""
        self.campus = ""
        self.location = ""
        self.teacher = ""
        self.class_info = ""
        self.exam_type = ""
        self.credit = ""
        self.day = ""
        self.section = ""
        self.section_start = ""
        self.section_end = ""

    def to_dict(self):
        return {
            'name': self.name,
            'day': self.day,
            'section': self.section,
            'section_start': self.section_start,
            'section_end': self.section_end,
            'weeks': self.weeks,
            'campus': self.campus,
            'location': self.location,
            'teacher': self.teacher,
            'class_info': self.class_info,
            'exam_type': self.exam_type,
            'credit': self.credit
        }


class PDFParser:
    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.student_name = ""
        self.student_id = ""
        self.semester = ""
        self.courses = []

    def parse(self):
        with pdfplumber.open(self.pdf_path) as pdf:
            for page in pdf.pages:
                self._parse_page(page)
        return self.courses

    def _parse_page(self, page):
        text = page.extract_text()
        if text:
            self._parse_header(text)
        tables = page.extract_tables()
        if tables:
            self._parse_table(tables[0])

    def _parse_header(self, text):
        lines = text.split('\n')
        for line in lines:
            if '课表' in line:
                self.student_name = line.replace('课表', '').strip()
            if '学号' in line:
                match = re.search(r'学号[：:]\s*(\d+)', line)
                if match:
                    self.student_id = match.group(1)
            if '学期' in line:
                match = re.search(r'(\d{4}-\d{4}学年第\d学期)', line)
                if match:
                    self.semester = match.group(1)

    def _parse_table(self, table):
        if len(table) < 2:
            return
        days = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
        for row_idx in range(2, len(table)):
            row = table[row_idx]
            if not row or len(row) < 3:
                continue
            section = str(row[1]).strip() if row[1] else ""
            for col_idx in range(2, min(len(row), len(days) + 2)):
                cell = row[col_idx]
                if cell and str(cell).strip():
                    day = days[col_idx - 2]
                    courses = self._parse_course_cell(str(cell), day, section)
                    for course in courses:
                        if course and course.weeks:
                            self.courses.append(course)

    def _parse_course_cell(self, cell, day, section):
        courses = []
        lines = cell.split('\n')
        current_course_text = ""
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            is_marker_only = line == '★' or line == '○'
            is_new_course = False
            if is_marker_only:
                is_new_course = False
            elif line.startswith('★') or line.startswith('○'):
                is_new_course = True
            elif line.endswith('★') or line.endswith('○'):
                is_new_course = True
            elif i == 0:
                is_new_course = True
            if is_new_course:
                if current_course_text:
                    course = self._extract_course_info(current_course_text, day, section)
                    if course:
                        courses.append(course)
                current_course_text = line
            else:
                if current_course_text:
                    current_course_text += line
        if current_course_text:
            course = self._extract_course_info(current_course_text, day, section)
            if course:
                courses.append(course)
        return courses

    def _extract_course_info(self, course_str, day, section):
        course_str = course_str.strip()
        if not course_str:
            return None
        if course_str.startswith('★') or course_str.startswith('○'):
            course_str = course_str[1:]
        name_match = re.match(r'([\u4e00-\u9fa5]+)', course_str)
        if not name_match:
            return None
        course = Course()
        course.name = name_match.group(1)
        course.day = day
        section_match = re.search(r'[\(（](\d+)-(\d+)节[\)）]', course_str)
        if section_match:
            course.section_start = section_match.group(1)
            course.section_end = section_match.group(2)
            course.section = f"{course.section_start}-{course.section_end}"
        else:
            course.section = section
            course.section_start = section
            course.section_end = section
        weeks_match = re.search(r'(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)周(?:\([单双]\))?', course_str)
        if weeks_match:
            course.weeks = weeks_match.group(1)
            if '(单)' in course_str:
                course.weeks += '(单)'
            elif '(双)' in course_str:
                course.weeks += '(双)'
            if '周' not in course.weeks:
                course.weeks += '周'
        campus_match = re.search(r'校区[：:]([^/／\n]+)', course_str)
        if campus_match:
            course.campus = campus_match.group(1).strip()
        location_match = re.search(r'场地[：:]([^/／\n]+)', course_str)
        if location_match:
            course.location = location_match.group(1).strip()
        teacher_match = re.search(r'教师[：:]([^/／\n]+)', course_str)
        if teacher_match:
            course.teacher = teacher_match.group(1).strip()
        if course.name and course.weeks:
            return course
        return None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/parse-pdf', methods=['POST'])
def parse_pdf_handler():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    if file and file.filename.endswith('.pdf'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_{filename}")
        file.save(filepath)
        try:
            parser = PDFParser(filepath)
            courses = parser.parse()
            result = {
                'student_name': parser.student_name,
                'student_id': parser.student_id,
                'semester': parser.semester,
                'courses': [c.to_dict() for c in courses]
            }
            try:
                os.remove(filepath)
            except:
                pass
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return jsonify({'error': '只支持PDF文件'}), 400
