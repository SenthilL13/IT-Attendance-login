# Attendance Manager

A full-stack web application for handling employee attendance.

## Tech Stack
- **Frontend**: React, Tailwind CSS v4, Vite, Axios, Lucide React
- **Backend**: Python Flask, Flask-SQLAlchemy, SQLite
- **Features**: Excel-like table, date/employee filtering, monthly dashboard, export to CSV.

## Project Structure
- `backend/` - Flask API and database
- `frontend/` - React SPA

---

## Running the Application

### 1. Backend Setup

Open a terminal and navigate to the backend folder:
```bash
cd backend
```

Create a virtual environment:
```bash
python -m venv venv
```

Activate the virtual environment:
- Windows: `.\venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Run the backend server (runs on `http://127.0.0.1:5000`):
```bash
python app.py
```
*(The SQLite database and seed data will be created automatically on the first run).*

### 2. Frontend Setup

Open a new terminal and navigate to the frontend folder:
```bash
cd frontend
```

Install Node.js dependencies:
```bash
npm install
```

Start the Vite development server (runs on `http://localhost:5173`):
```bash
npm run dev
```

### 3. Usage

1. Open your browser and go to the frontend URL (usually `http://localhost:5173`).
2. Log in using the default demo credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Enjoy managing attendances!
