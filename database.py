import os
import random
import string
from datetime import datetime
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager

_pool = None

def _get_pool():
    global _pool
    if _pool is None:
        url = os.environ.get('DATABASE_URL', 'postgresql://localhost/classwrite')
        _pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=url)
    return _pool

@contextmanager
def get_db():
    conn = _get_pool().getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)

def _dt(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    # Try parsing string timestamps
    try:
        from datetime import datetime as dt
        parsed = dt.fromisoformat(str(val).replace('+00:00', '').split('+')[0])
        return parsed.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    except:
        return str(val)

# ─────────────────────────────────────────────
#  SCHEMA INIT
# ─────────────────────────────────────────────

def init_db():
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute('''
            CREATE TABLE IF NOT EXISTS teachers (
                id            SERIAL PRIMARY KEY,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS classes (
                id         SERIAL PRIMARY KEY,
                teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                grade      TEXT NOT NULL,
                class_code TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id         SERIAL PRIMARY KEY,
                name       TEXT NOT NULL,
                pin_hash   TEXT NOT NULL,
                class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, class_id)
            )
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS assignments (
                id         SERIAL PRIMARY KEY,
                class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                title      TEXT NOT NULL,
                question   TEXT NOT NULL,
                resources  JSONB DEFAULT '[]',
                criteria   JSONB DEFAULT '[]',
                mindmap    TEXT,
                images     JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS submissions (
                id            SERIAL PRIMARY KEY,
                student_id    INTEGER REFERENCES students(id) ON DELETE CASCADE,
                student_name  TEXT NOT NULL,
                assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
                class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                content       TEXT,
                status        TEXT DEFAULT 'submitted',
                submitted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cur.execute('''
            CREATE TABLE IF NOT EXISTS student_work (
                id            SERIAL PRIMARY KEY,
                student_id    INTEGER REFERENCES students(id) ON DELETE CASCADE,
                student_name  TEXT NOT NULL,
                assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
                class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                content       TEXT,
                last_updated  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status        TEXT DEFAULT 'in_progress',
                UNIQUE(student_id, assignment_id)
            )
        ''')

        cur.close()
        print("Database tables created/verified.")

# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def _generate_class_code():
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(chars, k=6))
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute('SELECT id FROM classes WHERE class_code = %s', (code,))
            if not cur.fetchone():
                cur.close()
                return code

# ─────────────────────────────────────────────
#  TEACHERS
# ─────────────────────────────────────────────

def create_teacher(name, email, password_hash):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO teachers (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id',
            (name, email, password_hash)
        )
        teacher_id = cur.fetchone()[0]
        cur.close()
    return get_teacher_by_id(teacher_id)

def get_teacher_by_email(email):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM teachers WHERE email = %s', (email,))
        row = cur.fetchone()
        cur.close()
    if row:
        return {'id': row[0], 'name': row[1], 'email': row[2], 'password_hash': row[3], 'created_at': _dt(row[4])}
    return None

def get_teacher_by_id(teacher_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM teachers WHERE id = %s', (teacher_id,))
        row = cur.fetchone()
        cur.close()
    if row:
        return {'id': row[0], 'name': row[1], 'email': row[2], 'password_hash': row[3], 'created_at': _dt(row[4])}
    return None

# ─────────────────────────────────────────────
#  STUDENTS
# ─────────────────────────────────────────────

def create_student(name, pin_hash, class_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO students (name, pin_hash, class_id) VALUES (%s, %s, %s) RETURNING id',
            (name, pin_hash, class_id)
        )
        student_id = cur.fetchone()[0]
        cur.close()
    return get_student_by_id(student_id)

def get_student_by_id(student_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM students WHERE id = %s', (student_id,))
        row = cur.fetchone()
        cur.close()
    if row:
        return {'id': row[0], 'name': row[1], 'pin_hash': row[2], 'class_id': row[3], 'created_at': _dt(row[4])}
    return None

def get_student_by_name_and_class(name, class_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'SELECT * FROM students WHERE LOWER(name) = LOWER(%s) AND class_id = %s',
            (name, class_id)
        )
        row = cur.fetchone()
        cur.close()
    if row:
        return {'id': row[0], 'name': row[1], 'pin_hash': row[2], 'class_id': row[3], 'created_at': _dt(row[4])}
    return None

# ─────────────────────────────────────────────
#  CLASSES
# ─────────────────────────────────────────────

def create_class(teacher_id, name, grade):
    code = _generate_class_code()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO classes (teacher_id, name, grade, class_code) VALUES (%s, %s, %s, %s) RETURNING id',
            (teacher_id, name, grade, code)
        )
        class_id = cur.fetchone()[0]
        cur.close()
    return get_class_by_id(class_id)

def get_class_by_id(class_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM classes WHERE id = %s', (class_id,))
        row = cur.fetchone()
        cur.close()
    if row:
        return _row_to_class(row)
    return None

def get_class_by_code(code):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM classes WHERE class_code = %s', (code.upper(),))
        row = cur.fetchone()
        cur.close()
    if row:
        return _row_to_class(row)
    return None

def get_classes_by_teacher(teacher_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM classes WHERE teacher_id = %s ORDER BY created_at DESC', (teacher_id,))
        rows = cur.fetchall()
        cur.close()
    return [_row_to_class(r) for r in rows]

def update_class(class_id, teacher_id, name, grade):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'UPDATE classes SET name = %s, grade = %s WHERE id = %s AND teacher_id = %s',
            (name, grade, class_id, teacher_id)
        )
        cur.close()
    return get_class_by_id(class_id)

def delete_class(class_id, teacher_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('DELETE FROM classes WHERE id = %s AND teacher_id = %s', (class_id, teacher_id))
        cur.close()

def _row_to_class(row):
    return {
        'id': row[0],
        'teacher_id': row[1],
        'name': row[2],
        'grade': row[3],
        'class_code': row[4],
        'created_at': _dt(row[5])
    }

# ─────────────────────────────────────────────
#  ASSIGNMENTS
# ─────────────────────────────────────────────

def save_assignment(class_id, teacher_id, title, question, resources, criteria, mindmap, images):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            '''INSERT INTO assignments (class_id, teacher_id, title, question, resources, criteria, mindmap, images)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (class_id, teacher_id, title, question,
             psycopg2.extras.Json(resources),
             psycopg2.extras.Json(criteria),
             mindmap,
             psycopg2.extras.Json(images))
        )
        assignment_id = cur.fetchone()[0]
        cur.close()
    return get_assignment(assignment_id)

def get_assignment(assignment_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM assignments WHERE id = %s', (assignment_id,))
        row = cur.fetchone()
        cur.close()
    if row:
        return _row_to_assignment(row)
    return None

def get_assignments_by_class(class_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM assignments WHERE class_id = %s ORDER BY created_at DESC', (class_id,))
        rows = cur.fetchall()
        cur.close()
    return [_row_to_assignment(r) for r in rows]

def update_assignment(assignment_id, teacher_id, title, question, resources, criteria, mindmap, images):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            '''UPDATE assignments SET title=%s, question=%s, resources=%s, criteria=%s, mindmap=%s, images=%s
               WHERE id=%s AND teacher_id=%s''',
            (title, question,
             psycopg2.extras.Json(resources),
             psycopg2.extras.Json(criteria),
             mindmap,
             psycopg2.extras.Json(images),
             assignment_id, teacher_id)
        )
        cur.close()
    return get_assignment(assignment_id)

def delete_assignment(assignment_id, teacher_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('DELETE FROM assignments WHERE id = %s AND teacher_id = %s', (assignment_id, teacher_id))
        cur.close()

def _row_to_assignment(row):
    return {
        'id': row[0],
        'class_id': row[1],
        'teacher_id': row[2],
        'title': row[3],
        'question': row[4],
        'resources': row[5] or [],
        'criteria': row[6] or [],
        'mindmap': row[7] or '',
        'images': row[8] or [],
        'created_at': _dt(row[9])
    }

# ─────────────────────────────────────────────
#  SUBMISSIONS
# ─────────────────────────────────────────────

def save_submission(student_id, student_name, assignment_id, class_id, content):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'SELECT id FROM submissions WHERE student_id=%s AND assignment_id=%s',
            (student_id, assignment_id)
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                '''UPDATE submissions SET content=%s, submitted_at=CURRENT_TIMESTAMP, status='submitted'
                   WHERE student_id=%s AND assignment_id=%s''',
                (content, student_id, assignment_id)
            )
        else:
            cur.execute(
                '''INSERT INTO submissions (student_id, student_name, assignment_id, class_id, content, status)
                   VALUES (%s, %s, %s, %s, %s, 'submitted')''',
                (student_id, student_name, assignment_id, class_id, content)
            )
        cur.close()

def get_submissions_by_class(class_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM submissions WHERE class_id=%s ORDER BY submitted_at DESC', (class_id,))
        rows = cur.fetchall()
        cur.close()
    return [_row_to_submission(r) for r in rows]

def get_submissions_by_student(student_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM submissions WHERE student_id=%s ORDER BY submitted_at DESC', (student_id,))
        rows = cur.fetchall()
        cur.close()
    return [_row_to_submission(r) for r in rows]

def get_submissions_by_assignment(assignment_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT * FROM submissions WHERE assignment_id=%s ORDER BY submitted_at DESC', (assignment_id,))
        rows = cur.fetchall()
        cur.close()
    return [_row_to_submission(r) for r in rows]

def _row_to_submission(row):
    # New schema: id, student_id, student_name, assignment_id, class_id, content, status, submitted_at
    # Old schema: id, student_name, assignment_id, class_id, content, status, submitted_at
    if len(row) >= 8:
        return {
            'id': row[0],
            'student_id': row[1],
            'student_name': row[2],
            'assignment_id': row[3],
            'class_id': row[4],
            'content': str(row[5] or ''),
            'status': row[6],
            'submitted_at': _dt(row[7])
        }
    else:
        return {
            'id': row[0],
            'student_id': None,
            'student_name': row[1],
            'assignment_id': row[2],
            'class_id': row[3],
            'content': str(row[4] or ''),
            'status': row[5],
            'submitted_at': _dt(row[6])
        }

# ─────────────────────────────────────────────
#  STUDENT WORK (in-progress)
# ─────────────────────────────────────────────

def save_student_work(student_id, student_name, assignment_id, class_id, content):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            '''INSERT INTO student_work (student_id, student_name, assignment_id, class_id, content, last_updated, status)
               VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, 'in_progress')
               ON CONFLICT (student_id, assignment_id)
               DO UPDATE SET content=%s, last_updated=CURRENT_TIMESTAMP, status='in_progress' ''',
            (student_id, student_name, assignment_id, class_id, content, content)
        )
        cur.close()

def get_student_work_by_class(class_id):
    with get_db() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            'SELECT * FROM student_work WHERE class_id=%s ORDER BY last_updated DESC',
            (class_id,)
        )
        rows = cur.fetchall()
        cur.close()
    result = {}
    for row in rows:
        student_name  = row['student_name']
        assignment_id = row['assignment_id']
        content       = row['content']
        last_updated  = row['last_updated']
        status        = row['status']
        key = f"{student_name}_{assignment_id}"
        result[key] = {
            'student_name':  student_name,
            'assignment_id': assignment_id,
            'class_id':      row['class_id'],
            'content':       str(content or ''),
            'last_updated':  _dt(last_updated),
            'status':        status
        }
    return result

def delete_student_work(student_id, assignment_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'DELETE FROM student_work WHERE student_id=%s AND assignment_id=%s',
            (student_id, assignment_id)
        )
        cur.close()