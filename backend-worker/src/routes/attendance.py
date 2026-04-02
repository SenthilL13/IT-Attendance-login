from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
import csv
import io

from models import Attendance, User
from dependencies import get_db, login_required, admin_required

router = APIRouter()

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

class ActionRequest(BaseModel):
    action: str

@router.post('/attendance/action')
def handle_action(data: ActionRequest, db: Session = Depends(get_db), payload: dict = Depends(login_required)):
    user_id = payload['user_id']
    action = data.action
    now_date = datetime.now().strftime('%Y-%m-%d')
    now_time = datetime.now().strftime('%H:%M:%S')

    record = db.query(Attendance).filter(Attendance.user_id == user_id, Attendance.date == now_date).first()

    if action == 'check_in':
        if record:
            raise HTTPException(status_code=400, detail='Already checked in today')
        record = Attendance(user_id=user_id, date=now_date, shift_in=now_time, status='Present')
        db.add(record)
    else:
        if not record:
            raise HTTPException(status_code=400, detail='Must check in first')
            
        if action == 'lunch_out':
            if record.lunch_out: raise HTTPException(status_code=400, detail='Already went to lunch')
            record.lunch_out = now_time
        elif action == 'lunch_in':
            if not record.lunch_out: raise HTTPException(status_code=400, detail='Must lunch out first')
            if record.lunch_in: raise HTTPException(status_code=400, detail='Already returned from lunch')
            record.lunch_in = now_time
        elif action == 'check_out':
            if record.shift_out: raise HTTPException(status_code=400, detail='Already checked out')
            record.shift_out = now_time
            record.net_hours = calculate_net_hours(record.shift_in, record.shift_out, record.lunch_out, record.lunch_in)
        else:
            raise HTTPException(status_code=400, detail='Invalid action')

    db.commit()
    db.refresh(record)
    return record.to_dict()

@router.get('/attendance/today')
def get_today_attendance(db: Session = Depends(get_db), payload: dict = Depends(login_required)):
    user_id = payload['user_id']
    now_date = datetime.now().strftime('%Y-%m-%d')
    record = db.query(Attendance).filter(Attendance.user_id == user_id, Attendance.date == now_date).first()
    
    if record:
        return record.to_dict()
    return {}

@router.get('/attendance/me')
def my_attendance(db: Session = Depends(get_db), payload: dict = Depends(login_required)):
    user_id = payload['user_id']
    records = db.query(Attendance).filter(Attendance.user_id == user_id).order_by(Attendance.date.desc()).all()
    return [r.to_dict() for r in records]

@router.get('/attendance')
def get_attendance(db: Session = Depends(get_db), payload: dict = Depends(admin_required)):
    # Order by Attendance date desc, User name (using join)
    records = db.query(Attendance).join(User).order_by(Attendance.date.desc(), User.name).all()
    return {'records': [r.to_dict() for r in records]}

@router.get('/attendance/summary')
def get_summary(month: str = Query(None), db: Session = Depends(get_db), payload: dict = Depends(admin_required)):
    query = db.query(Attendance)
    if month:
        query = query.filter(Attendance.date.like(f'{month}%'))

    records = query.all()
    total = len(records)
    present = sum(1 for r in records if r.status == 'Present')
    absent = total - present
    hours = [r.net_hours for r in records if r.net_hours is not None]
    avg_hrs = round(sum(hours) / len(hours), 2) if hours else 0

    return {
        'total': total,
        'present': present,
        'absent': absent,
        'avg_hours': avg_hrs,
    }

@router.get('/attendance/export', response_class=PlainTextResponse)
def export_csv(db: Session = Depends(get_db), payload: dict = Depends(admin_required)):
    records = db.query(Attendance).join(User).order_by(Attendance.date, User.name).all()

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

    return PlainTextResponse(
        content=output.getvalue(),
        media_type='text/csv',
        headers={"Content-Disposition": "attachment; filename=attendance.csv"}
    )
