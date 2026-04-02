from extensions import db, bcrypt
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(10), default='employee') # 'admin' or 'employee'
    attendances = db.relationship('Attendance', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'username': self.username,
            'role': self.role
        }

    def set_password(self, password):
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password, password)


class Attendance(db.Model):
    __tablename__ = 'attendance'

    id         = db.Column(db.Integer, primary_key=True)
    date       = db.Column(db.String(10), nullable=False)   # YYYY-MM-DD
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    shift_in   = db.Column(db.String(10), nullable=True)     # HH:MM:SS
    shift_out  = db.Column(db.String(10), nullable=True)
    lunch_out  = db.Column(db.String(10), nullable=True)
    lunch_in   = db.Column(db.String(10), nullable=True)
    net_hours  = db.Column(db.Float, nullable=True)
    status     = db.Column(db.String(10), default='Absent') # Present / Absent

    def to_dict(self):
        return {
            'id':          self.id,
            'date':        self.date,
            'user_id':     self.user_id,
            'user_name':   self.user.name if self.user else '',
            'shift_in':    self.shift_in,
            'shift_out':   self.shift_out,
            'lunch_out':   self.lunch_out,
            'lunch_in':    self.lunch_in,
            'net_hours':   self.net_hours,
            'status':      self.status
        }
