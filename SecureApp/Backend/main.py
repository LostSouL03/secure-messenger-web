import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List

app = FastAPI()

# Store all active connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove stale connections if sending fails
                self.active_connections.remove(connection)

manager = ConnectionManager()

# 1. WebSocket Route
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive encrypted data (Text, Voice, or File)
            data = await websocket.receive_text()
            # Broadcast it to everyone else
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# 2. Serve Static Files (styles.css, app.js, encryption.js)
# This looks into your "Frontend" folder
app.mount("/", StaticFiles(directory="Frontend", html=True), name="static")

# 3. Fallback to index.html
@app.get("/")
async def get_index():
    return FileResponse("Frontend/index.html")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
