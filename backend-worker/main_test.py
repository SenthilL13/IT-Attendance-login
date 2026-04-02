from fastapi import FastAPI
from workers import WorkerEntrypoint
import asgi

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

class Default(WorkerEntrypoint):
    async def fetch(self, request, env):
        return await asgi.fetch(app, request, env)
