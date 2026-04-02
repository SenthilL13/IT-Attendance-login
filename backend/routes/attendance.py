from flask import Blueprint, request, jsonify, session, make_response
from models import Attendance, User
from extensions import db
from datetime import datetime
import csv
import io

attendance_bp = Blueprint('attendance', __name__)

def login_required():
    if not session.get('user_id'):
        return jsonify({'error': 'Unauthorized'}), 401
    return None

def admin_required():
    if not session.get('user_id'):
        return jsonify({'error': 'Unauthorized'}), 401
    if session.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    return None

def calculate_net_hours(shift_in, shift_out, lunch_out, lunch_in):
    if not shift_in or not shift_out:
        return None
    
    fmt = '%H:%M:%S'
    try:
        si = datetime.strptime(shift_in, fmt)
        so = datetime.strptime(shift_out, fmt)
        total_seconds = (so - si).total_seconds()
        
        if lunch_out and lunch_in:
            lo = datetime.strptime(lunch_out, fmt)
            li = datetime.strptime(lunch_in, fmt)
            lunch_seconds = (li - lo).total_seconds()
            total_seconds -= lunch_seconds
            
        return round(total_seconds / 3600, 2)
    except Exception as e:
        return None

# ── POST /attendance/action ────────────────────────────────────────────────────
@attendance_bp.route('/attendance/action', methods=['POST'])
def handle_action():
    err = login_required()
    if err:
        return err

    user_id = session.get('user_id')
    data = request.get_json()
    action = data.get('action') # 'check_in', 'lunch_out', 'lunch_in', 'check_out'
    now_date = datetime.now().strftime('%Y-%m-%d')
    now_time = datetime.now().strftime('%H:%M:%S')

    record = Attendance.query.filter_by(user_id=user_id, date=now_date).first()

    if action == 'check_in':
        if record:
            return jsonify({'error': 'Already checked in today'}), 400
        record = Attendance(user_id=user_id, date=now_date, shift_in=now_time, status='Present')
        db.session.add(record)
    else:
        if not record:
            return jsonify({'error': 'Must check in first'}), 400
            
        if action == 'lunch_out':
            if record.lunch_out: return jsonify({'error': 'Already went to lunch'}), 400
            record.lunch_out = now_time
        elif action == 'lunch_in':
            if not record.lunch_out: return jsonify({'error': 'Must lunch out first'}), 400
            if record.lunch_in: return jsonify({'error': 'Already returned from lunch'}), 400
            record.lunch_in = now_time
        elif action == 'check_out':
            if record.shift_out: return jsonify({'error': 'Already checked out'}), 400
            record.shift_out = now_time
            record.net_hours = calculate_net_hours(record.shift_in, record.shift_out, record.lunch_out, record.lunch_in)
        else:
            return jsonify({'error': 'Invalid action'}), 400

    db.session.commit()
    return jsonify(record.to_dict()), 200

# ── GET /attendance/today ──────────────────────────────────────────────────────
@attendance_bp.route('/attendance/today', methods=['GET'])
def get_today_attendance():
    err = login_required()
    if err:
        return err
        
    user_id = session.get('user_id')
    now_date = datetime.now().strftime('%Y-%m-%d')
    record = Attendance.query.filter_by(user_id=user_id, date=now_date).first()
    
    if record:
        return jsonify(record.to_dict()), 200
    return jsonify({}), 200

# ── GET /attendance/me ─────────────────────────────────────────────────────────
@attendance_bp.route('/attendance/me', methods=['GET'])
def my_attendance():
    err = login_required()
    if err:
        return err
        
    user_id = session.get('user_id')
    records = Attendance.query.filter_by(user_id=user_id).order_by(Attendance.date.desc()).all()
    return jsonify([r.to_dict() for r in records]), 200

# ── GET /attendance (Admin) ────────────────────────────────────────────────────
@attendance_bp.route('/attendance', methods=['GET'])
def get_attendance():
    err = admin_required()
    if err:
        return err

    query = Attendance.query.join(User).order_by(Attendance.date.desc(), User.name)
    records = query.all()
    return jsonify({'records': [r.to_dict() for r in records]}), 200

# ── SUMMARY AND EXPORT ARE ADMIN ONLY ──────────────────────────────────────────
@attendance_bp.route('/attendance/summary', methods=['GET'])
def get_summary():
    err = admin_required()
    if err:
        return err

    month = request.args.get('month')
    query = Attendance.query
    if month:
        query = query.filter(Attendance.date.like(f'{month}%'))

    records = query.all()
    total = len(records)
    present = sum(1 for r in records if r.status == 'Present')
    absent = total - present
    hours = [r.net_hours for r in records if r.net_hours is not None]
    avg_hrs = round(sum(hours) / len(hours), 2) if hours else 0

    return jsonify({
        'total': total,
        'present': present,
        'absent': absent,
        'avg_hours': avg_hrs,
    }), 200

@attendance_bp.route('/attendance/export', methods=['GET'])
def export_csv():
    err = admin_required()
    if err:
        return err

    records = Attendance.query.join(User).order_by(Attendance.date, User.name).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Employee', 'Shift In', 'Shift Out', 'Lunch Out', 'Lunch In', 'Net Hours', 'Status'])

    for r in records:
        writer.writerow([
            r.date, r.user.name,
            r.shift_in or '', r.shift_out or '',
            r.lunch_out or '', r.lunch_in or '',
            r.net_hours or '', r.status
        ])

    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=attendance.csv'
    response.headers['Content-Type'] = 'text/csv'
    return response
