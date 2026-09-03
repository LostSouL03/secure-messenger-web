import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from typing import List

app = FastAPI()

# --- FRONTEND PATH RESOLUTION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Structure: /SecureApp/Backend/main.py  ->  /SecureApp/Frontend
frontend_path = os.path.abspath(os.path.join(BASE_DIR, "..", "Frontend"))

# Fallback for a flatter layout, in case this file ever moves.
if not os.path.exists(frontend_path):
    frontend_path = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "Frontend"))

print(f"--- Server checking for Frontend at: {frontend_path} ---")


# --- WEBSOCKET MANAGER (Relays Text, Voice, and Files) ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str, sender: WebSocket):
        # Skip the sender: the client already renders its own message
        # locally, so echoing it back is pure wasted work (and previously
        # meant every client processed its own messages just to filter them
        # out again).
        for connection in self.active_connections:
            if connection is sender:
                continue
            try:
                await connection.send_text(message)
            except Exception:
                # If a connection is dead, skip it — it'll be cleaned up
                # when its own receive loop raises WebSocketDisconnect.
                pass


manager = ConnectionManager()


# --- ROUTES ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive encrypted Base64 data from one user
            data = await websocket.receive_text()
            # Broadcast it to everyone else
            await manager.broadcast(data, sender=websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# --- SERVE STATIC FILES ---
# Mounted last, and at "/", so it acts as a catch-all: StaticFiles(html=True)
# already serves index.html for "/" and any other unmatched path, so a
# separate `@app.get("/")` route is unreachable dead code and was removed.
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")
else:
    print(f"ERROR: Could not find directory {frontend_path}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
