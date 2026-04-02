from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy_cloudflare_d1 import create_engine_from_binding
import jwt
from typing import Optional
from models import User

SECRET_KEY = "attendance_secret_key_2024"  # In prod, get from env
ALGORITHM = "HS256"

def get_db(request: Request):
    """
    Dependency to get a SQLAlchemy Session generated from the D1 binding.
    """
    env = request.scope.get("env")
    if not env or not getattr(env, "DB", None):
        raise HTTPException(status_code=500, detail="Database binding not found in environment")
        
    engine = create_engine_from_binding(env.DB)
    with Session(engine) as session:
        yield session

def get_current_user_token(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def login_required(payload: dict = Depends(get_current_user_token)):
    if not payload:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return payload

def admin_required(payload: dict = Depends(get_current_user_token)):
    if not payload:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload
