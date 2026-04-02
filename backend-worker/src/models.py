import hashlib
import os
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    username = Column(String(50), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    role = Column(String(10), default='employee') # 'admin' or 'employee'
    attendances = relationship('Attendance', back_populates='user', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'username': self.username,
            'role': self.role
        }

    def set_password(self, clear_password):
        salt = os.urandom(16)
        key = hashlib.pbkdf2_hmac('sha256', clear_password.encode('utf-8'), salt, 100000)
        self.password = salt.hex() + ':' + key.hex()

    def check_password(self, clear_password):
        if ':' not in self.password:
            return False
        salt_hex, key_hex = self.password.split(':')
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac('sha256', clear_password.encode('utf-8'), salt, 100000)
        return key.hex() == key_hex


class Attendance(Base):
    __tablename__ = 'attendance'

    id         = Column(Integer, primary_key=True)
    date       = Column(String(10), nullable=False)   # YYYY-MM-DD
    user_id    = Column(Integer, ForeignKey('users.id'), nullable=False)
    shift_in   = Column(String(10), nullable=True)     # HH:MM:SS
    shift_out  = Column(String(10), nullable=True)
    lunch_out  = Column(String(10), nullable=True)
    lunch_in   = Column(String(10), nullable=True)
    net_hours  = Column(Float, nullable=True)
    status     = Column(String(10), default='Absent') # Present / Absent

    user = relationship('User', back_populates='attendances')

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
