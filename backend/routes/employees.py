from flask import Blueprint, request, jsonify, session
from models import User
from extensions import db, bcrypt

employees_bp = Blueprint('employees', __name__)

def admin_required():
    if not session.get('user_id'):
        return jsonify({'error': 'Unauthorized'}), 401
    if session.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    return None

@employees_bp.route('/employees', methods=['GET'])
def get_employees():
    err = admin_required()
    if err: return err
    
    users = User.query.filter_by(role='employee').order_by(User.name).all()
    return jsonify([u.to_dict() for u in users]), 200

@employees_bp.route('/employees', methods=['POST'])
def create_employee():
    err = admin_required()
    if err: return err
    
    data = request.get_json()
    name = data.get('name', '').strip()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not all([name, username, password]):
        return jsonify({'error': 'Name, username, and password are required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 409

    emp = User(name=name, username=username, role='employee')
    emp.set_password(password)
    db.session.add(emp)
    db.session.commit()
    
    return jsonify(emp.to_dict()), 201

@employees_bp.route('/employees/<int:emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    err = admin_required()
    if err: return err
    
    emp = User.query.get_or_404(emp_id)
    if emp.role == 'admin':
        return jsonify({'error': 'Cannot delete admin'}), 403
        
    db.session.delete(emp)
    db.session.commit()
    return jsonify({'message': 'Employee deleted'}), 200
