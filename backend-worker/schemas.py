from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class UserOut(BaseModel):
    id: int
    name: str
    username: str
    role: str

    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    username: str
    password: str

class EmployeeCreate(BaseModel):
    name: str
    username: str
    password: str

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class AttendanceOut(BaseModel):
    id: int
    date: str
    user_id: int
    user_name: Optional[str] = ""
    shift_in: Optional[str] = None
    shift_out: Optional[str] = None
    lunch_out: Optional[str] = None
    lunch_in: Optional[str] = None
    net_hours: Optional[float] = None
    status: str

    model_config = ConfigDict(from_attributes=True)
