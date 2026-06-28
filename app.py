import eventlet
eventlet.monkey_patch()

from dotenv import load_dotenv
load_dotenv()

import os
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, send_from_directory, send_from_directory
from flask_socketio import SocketIO, emit
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import jwt

import database

app = Flask(__name__, static_folder='static/app', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-me-in-production')

CORS(app, resources={r"/api/*": {"origins": "*"}})
bcrypt = Bcrypt(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=True, engineio_logger=True)

with app.app_context():
    database.init_db()

# ─────────────────────────────────────────────
#  JWT HELPERS
# ─────────────────────────────────────────────

def create_token(payload: dict, expires_hours: int = 24 * 7) -> str:
    payload = dict(payload)
    payload['exp'] = datetime.now(tz=timezone.utc) + timedelta(hours=expires_hours)
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def require_teacher(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        data = decode_token(auth.split(' ', 1)[1])
        if not data or data.get('role') != 'teacher':
            return jsonify({'error': 'Invalid or expired token'}), 401
        request.teacher_id   = data['id']
        request.teacher_name = data['name']
        return f(*args, **kwargs)
    return wrapper

def require_student(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        data = decode_token(auth.split(' ', 1)[1])
        if not data or data.get('role') != 'student':
            return jsonify({'error': 'Invalid or expired token'}), 401
        request.student_id   = data['student_id']
        request.student_name = data['name']
        request.class_id     = data['class_id']
        request.class_code   = data['class_code']
        return f(*args, **kwargs)
    return wrapper

# ─────────────────────────────────────────────
#  AUTH — TEACHER
# ─────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name  = (data.get('name', '') or '').strip()
    email = (data.get('email', '') or '').strip().lower()
    pw    = (data.get('password', '') or '').strip()

    if not name or not email or not pw:
        return jsonify({'error': 'Name, email and password are required'}), 400
    if len(pw) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if database.get_teacher_by_email(email):
        return jsonify({'error': 'Email already registered'}), 409

    pw_hash = bcrypt.generate_password_hash(pw).decode('utf-8')
    teacher = database.create_teacher(name, email, pw_hash)
    token   = create_token({'id': teacher['id'], 'name': teacher['name'], 'email': teacher['email'], 'role': 'teacher'})
    return jsonify({'token': token, 'teacher': {'id': teacher['id'], 'name': teacher['name'], 'email': teacher['email']}}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data  = request.json or {}
    email = (data.get('email', '') or '').strip().lower()
    pw    = (data.get('password', '') or '').strip()

    teacher = database.get_teacher_by_email(email)
    if not teacher or not bcrypt.check_password_hash(teacher['password_hash'], pw):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_token({'id': teacher['id'], 'name': teacher['name'], 'email': teacher['email'], 'role': 'teacher'})
    return jsonify({'token': token, 'teacher': {'id': teacher['id'], 'name': teacher['name'], 'email': teacher['email']}})


@app.route('/api/auth/me', methods=['GET'])
@require_teacher
def me():
    teacher = database.get_teacher_by_id(request.teacher_id)
    if not teacher:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'id': teacher['id'], 'name': teacher['name'], 'email': teacher['email']})

# ─────────────────────────────────────────────
#  AUTH — STUDENT
# ─────────────────────────────────────────────

@app.route('/api/auth/join', methods=['POST'])
def student_join():
    data       = request.json or {}
    name       = (data.get('name', '') or '').strip()
    class_code = (data.get('class_code', '') or '').strip().upper()
    pin        = (data.get('pin', '') or '').strip()

    if not name or not class_code or not pin:
        return jsonify({'error': 'Name, class code and PIN are required'}), 400
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be exactly 4 digits'}), 400

    cls = database.get_class_by_code(class_code)
    if not cls:
        return jsonify({'error': 'Class not found — check the code and try again'}), 404

    existing = database.get_student_by_name_and_class(name, cls['id'])

    if existing:
        if not bcrypt.check_password_hash(existing['pin_hash'], pin):
            return jsonify({'error': 'Wrong PIN — try again or ask your teacher'}), 401
        student = existing
    else:
        pin_hash = bcrypt.generate_password_hash(pin).decode('utf-8')
        student  = database.create_student(name, pin_hash, cls['id'])

    token = create_token({
        'student_id': student['id'],
        'name':       student['name'],
        'class_id':   cls['id'],
        'class_code': cls['class_code'],
        'class_name': cls['name'],
        'grade':      cls['grade'],
        'role':       'student'
    }, expires_hours=12)

    return jsonify({
        'token':        token,
        'student':      {'id': student['id'], 'name': student['name']},
        'class':        {'id': cls['id'], 'name': cls['name'], 'grade': cls['grade'], 'class_code': cls['class_code']},
        'is_returning': existing is not None
    })

# ─────────────────────────────────────────────
#  CLASSES
# ─────────────────────────────────────────────

@app.route('/api/classes', methods=['GET', 'POST'])
@require_teacher
def classes():
    if request.method == 'GET':
        return jsonify(database.get_classes_by_teacher(request.teacher_id))

    data  = request.json or {}
    name  = (data.get('name', '') or '').strip()
    grade = (data.get('grade', '') or '').strip()
    if not name or not grade:
        return jsonify({'error': 'Class name and grade are required'}), 400

    cls = database.create_class(request.teacher_id, name, grade)
    return jsonify(cls), 201


@app.route('/api/classes/<int:class_id>', methods=['GET', 'PUT', 'DELETE'])
@require_teacher
def class_detail(class_id):
    cls = database.get_class_by_id(class_id)
    if not cls or cls['teacher_id'] != request.teacher_id:
        return jsonify({'error': 'Class not found'}), 404

    if request.method == 'GET':
        return jsonify(cls)
    if request.method == 'PUT':
        data  = request.json or {}
        name  = (data.get('name', cls['name']) or '').strip()
        grade = (data.get('grade', cls['grade']) or '').strip()
        return jsonify(database.update_class(class_id, request.teacher_id, name, grade))
    if request.method == 'DELETE':
        database.delete_class(class_id, request.teacher_id)
        return jsonify({'success': True})

# ─────────────────────────────────────────────
#  ASSIGNMENTS
# ─────────────────────────────────────────────

@app.route('/api/classes/<int:class_id>/assignments', methods=['GET', 'POST'])
@require_teacher
def class_assignments(class_id):
    cls = database.get_class_by_id(class_id)
    if not cls or cls['teacher_id'] != request.teacher_id:
        return jsonify({'error': 'Class not found'}), 404

    if request.method == 'GET':
        return jsonify(database.get_assignments_by_class(class_id))

    data     = request.json or {}
    title    = (data.get('title', '') or '').strip()
    question = (data.get('question', '') or '').strip()
    if not title or not question:
        return jsonify({'error': 'Title and question are required'}), 400

    assignment = database.save_assignment(
        class_id, request.teacher_id, title, question,
        data.get('resources', []), data.get('criteria', []),
        data.get('mindmap', ''), data.get('images', [])
    )
    return jsonify(assignment), 201


@app.route('/api/assignments/<int:assignment_id>', methods=['GET', 'PUT', 'DELETE'])
@require_teacher
def assignment_detail(assignment_id):
    a = database.get_assignment(assignment_id)
    if not a or a['teacher_id'] != request.teacher_id:
        return jsonify({'error': 'Assignment not found'}), 404

    if request.method == 'GET':
        return jsonify(a)
    if request.method == 'PUT':
        data = request.json or {}
        updated = database.update_assignment(
            assignment_id, request.teacher_id,
            data.get('title', a['title']),
            data.get('question', a['question']),
            data.get('resources', a['resources']),
            data.get('criteria', a['criteria']),
            data.get('mindmap', a['mindmap']),
            data.get('images', a['images'])
        )
        return jsonify(updated)
    if request.method == 'DELETE':
        database.delete_assignment(assignment_id, request.teacher_id)
        return jsonify({'success': True})


@app.route('/api/classes/<int:class_id>/submissions', methods=['GET'])
@require_teacher
def class_submissions(class_id):
    cls = database.get_class_by_id(class_id)
    if not cls or cls['teacher_id'] != request.teacher_id:
        return jsonify({'error': 'Class not found'}), 404
    return jsonify(database.get_submissions_by_class(class_id))


@app.route('/api/classes/<int:class_id>/live', methods=['GET'])
@require_teacher
def class_live(class_id):
    cls = database.get_class_by_id(class_id)
    if not cls or cls['teacher_id'] != request.teacher_id:
        return jsonify({'error': 'Class not found'}), 404
    return jsonify(database.get_student_work_by_class(class_id))

# ─────────────────────────────────────────────
#  STUDENT ROUTES
# ─────────────────────────────────────────────

@app.route('/api/student/assignments', methods=['GET'])
@require_student
def student_assignments():
    return jsonify(database.get_assignments_by_class(request.class_id))


@app.route('/api/student/submissions', methods=['GET'])
@require_student
def student_my_submissions():
    return jsonify(database.get_submissions_by_student(request.student_id))


@app.route('/api/student/submit', methods=['POST'])
@require_student
def student_submit():
    data    = request.json or {}
    content = data.get('content', '').strip()
    aid     = data.get('assignment_id')
    if not content or not aid:
        return jsonify({'error': 'Content and assignment_id are required'}), 400

    a = database.get_assignment(aid)
    if not a or a['class_id'] != request.class_id:
        return jsonify({'error': 'Assignment not found'}), 404

    database.save_submission(request.student_id, request.student_name, aid, request.class_id, content)
    database.delete_student_work(request.student_id, aid)

    socketio.emit('submission_update', {
        'student_name':  request.student_name,
        'assignment_id': aid,
        'class_id':      request.class_id,
        'content':       content,
        'submitted_at':  datetime.now().isoformat()
    })
    return jsonify({'success': True})


@app.route('/api/update_progress', methods=['POST'])
@require_student
def http_update_progress():
    data = request.json or {}
    aid  = data.get('assignment_id')
    if not aid:
        return jsonify({'error': 'assignment_id required'}), 400
    database.save_student_work(
        request.student_id, request.student_name,
        aid, request.class_id, data.get('content', '')
    )
    return jsonify({'success': True})

# ─────────────────────────────────────────────
#  SOCKET.IO
# ─────────────────────────────────────────────

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

@socketio.on('join_class_room')
def handle_join_room(data):
    """Teacher joins a room to watch a class."""
    from flask_socketio import join_room
    room = f"class_{data.get('class_id')}"
    join_room(room)
    print(f'Client {request.sid} joined room {room}')

@socketio.on('update_progress')
def handle_progress(data):
    database.save_student_work(
        data.get('student_id'), data.get('student_name'),
        data.get('assignment_id'), data.get('class_id'), data.get('content', '')
    )
    payload = {
        'student_name':  data.get('student_name'),
        'assignment_id': data.get('assignment_id'),
        'class_id':      data.get('class_id'),
        'content':       data.get('content', ''),
        'last_updated':  datetime.now().isoformat()
    }
    # Broadcast to everyone (teacher dashboard listening globally)
    emit('progress_update', payload, broadcast=True)
    # Also emit to the class-specific room
    room = f"class_{data.get('class_id')}"
    emit('progress_update', payload, room=room, include_self=False)
    print(f"progress_update emitted for {data.get('student_name')} in class {data.get('class_id')}")


@socketio.on('join_assignment')
def handle_join(data):
    payload = {
        'student_name':  data.get('student_name'),
        'assignment_id': data.get('assignment_id'),
        'class_id':      data.get('class_id'),
        'timestamp':     datetime.now().isoformat()
    }
    emit('student_joined', payload, broadcast=True)
    room = f"class_{data.get('class_id')}"
    emit('student_joined', payload, room=room, include_self=False)


@socketio.on('leave_assignment')
def handle_leave(data):
    database.delete_student_work(data.get('student_id'), data.get('assignment_id'))
    payload = {
        'student_name':  data.get('student_name'),
        'assignment_id': data.get('assignment_id'),
        'class_id':      data.get('class_id'),
        'timestamp':     datetime.now().isoformat()
    }
    emit('student_left', payload, broadcast=True)
    room = f"class_{data.get('class_id')}"
    emit('student_left', payload, room=room, include_self=False)


# ─────────────────────────────────────────────
#  SERVE REACT — must be last, catches all non-API routes
# ─────────────────────────────────────────────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'app')
    if path:
        full_path = os.path.join(static_dir, path)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            import mimetypes
            mime = mimetypes.guess_type(full_path)[0] or 'application/octet-stream'
            with open(full_path, 'rb') as f:
                return app.response_class(f.read(), mimetype=mime)
    with open(os.path.join(static_dir, 'index.html'), 'rb') as f:
        return app.response_class(f.read(), mimetype='text/html')

if __name__ == "__main__":
    from gevent import pywsgi
    from geventwebsocket.handler import WebSocketHandler
    port = int(os.environ.get('PORT', 8080))
    print(f'Starting server on port {port}')
    server = pywsgi.WSGIServer(('0.0.0.0', port), app, handler_class=WebSocketHandler)
    server.serve_forever()
else:
    application = app