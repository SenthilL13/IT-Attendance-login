from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from models import User
from schemas import EmployeeCreate, UserOut
from dependencies import get_db, admin_required

router = APIRouter()

@router.get('/employees', response_model=List[UserOut])
def get_employees(db: Session = Depends(get_db), payload: dict = Depends(admin_required)):
    users = db.query(User).filter(User.role == 'employee').order_by(User.name).all()
    # Pydantic handles parsing
    return users

@router.post('/employees', status_code=201)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db), payload: dict = Depends(admin_required)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=409, detail='Username already exists')

    emp = User(name=data.name, username=data.username, role='employee')
    emp.set_password(data.password)
    db.add(emp)
    db.commit()
    db.refresh(emp)

    return emp.to_dict()

@router.delete('/employees/{emp_id}')
def delete_employee(emp_id: int, db: Session = Depends(get_db), payload: dict = Depends(admin_required)):
    emp = db.query(User).filter(User.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail='Employee not found')
    if emp.role == 'admin':
        raise HTTPException(status_code=403, detail='Cannot delete admin')

    db.delete(emp)
    db.commit()
    return {'message': 'Employee deleted'}
