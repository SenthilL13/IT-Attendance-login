from flask import Flask
from flask_cors import CORS
from extensions import db, bcrypt
from routes.auth import auth_bp
from routes.employees import employees_bp
from routes.attendance import attendance_bp
from models import User, Attendance
import os

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = 'attendance_secret_key_2024'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_SECURE'] = False
    
    # Extensions
    db.init_app(app)
    bcrypt.init_app(app)
    CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(employees_bp, url_prefix='/api')
    app.register_blueprint(attendance_bp, url_prefix='/api')
    
    # Create tables and seed data
    with app.app_context():
        # Clean local db for structural update
        if os.path.exists('backend/database.db'):
            os.remove('backend/database.db')
        db.create_all()
        seed_data()
    
    return app

def seed_data():
    """Seed initial data if database is empty."""
    if User.query.count() == 0:
        admin = User(name='Admin', username='admin', role='admin')
        admin.set_password('admin123')
        
        emp1 = User(name='Alice Johnson', username='alice', role='employee')
        emp1.set_password('alice123')
        
        emp2 = User(name='Bob Smith', username='bob', role='employee')
        emp2.set_password('bob123')
        
        db.session.add_all([admin, emp1, emp2])
        db.session.commit()
        print("✅ Seeded admin and test employee data")

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
