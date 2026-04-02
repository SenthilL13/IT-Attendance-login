from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from workers import WorkerEntrypoint
import asgi

# Import routers
from routes import auth, employees, attendance

app = FastAPI(title="Attendance API", description="FastAPI Backend on Cloudflare Workers")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust as needed for production (e.g., your Cloudflare Pages domain)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make sure we add prefix matching what the frontend expects
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(employees.router, prefix="/api", tags=["Employees"])
app.include_router(attendance.router, prefix="/api", tags=["Attendance"])

@app.get("/")
async def root():
    return {"message": "Attendance API running on Cloudflare Workers"}

# The Worker Entrypoint
class Default(WorkerEntrypoint):
    async def fetch(self, request, env):
        # asgi.fetch automatically translates the Worker request and env
        # into the standard ASGI scope that FastAPI expects.
        return await asgi.fetch(app, request, env)
