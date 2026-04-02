from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from models import User
from schemas import LoginRequest, UserOut
from dependencies import get_db, get_current_user_token, SECRET_KEY, ALGORITHM
import jwt
import datetime

router = APIRouter()

@router.post('/login')
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    
    if user and user.check_password(data.password):
        # Create JWT payload
        payload = {
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=token,
            httponly=False,  # We need the frontend to not crash when not using it properly, but keeping it secure normally
            samesite="lax",
            max_age=86400 # 1 day
        )
        
        return {
            'message': 'Login successful',
            'user': user.to_dict()
        }

    raise HTTPException(status_code=401, detail='Invalid username or password')

@router.post('/logout')
def logout(response: Response):
    response.delete_cookie("session_token")
    return {'message': 'Logged out'}

@router.get('/me')
def me(db: Session = Depends(get_db), payload: dict = Depends(get_current_user_token)):
    if payload and "user_id" in payload:
        user = db.query(User).filter(User.id == payload["user_id"]).first()
        if user:
            return {'authenticated': True, 'user': user.to_dict()}
    raise HTTPException(status_code=401, detail="Not authenticated")
