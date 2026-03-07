import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List

app = FastAPI()

# 1. DYNAMIC PATH CALCULATION
# This finds the absolute path of main.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Move up two levels: Backend -> SecureApp -> root, then into Frontend
# Structure: /SecureApp/Backend/main.py  ->  /SecureApp/Frontend
frontend_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "Frontend"))

# Fallback: Check if Frontend is actually just one level up
if not os.path.exists(frontend_path):
    frontend_path = os.path.abspath(os.path.join(BASE_DIR, "..", "Frontend"))

print(f"--- Server checking for Frontend at: {frontend_path} ---")

# 2. WEBSOCKET MANAGER (Relays Text, Voice, and Files)
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # If a connection is dead, skip it
                pass

manager = ConnectionManager()

# 3. ROUTES
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive encrypted Base64 data from one user
            data = await websocket.receive_text()
            # Broadcast it to everyone else
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# 4. SERVE STATIC FILES
# We mount the Frontend folder to the root "/"
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")
else:
    print(f"ERROR: Could not find directory {frontend_path}")

# Catch-all for index.html
@app.get("/")
async def get_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
