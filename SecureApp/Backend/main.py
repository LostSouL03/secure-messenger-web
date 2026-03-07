from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()

# --- 1. FILE SERVING SETUP ---
# This finds the exact path to your folders, no matter where you run the script from
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Tell FastAPI where to find your CSS and JS folders
app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

# When a user goes to your main URL (e.g., http://localhost:8000), serve the index.html file
@app.get("/")
async def get_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# --- 2. WEBSOCKET (CHAT) SETUP ---
class ConnectionManager:
    def __init__(self):
        # Keeps track of whoever is connected to the chat
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str, sender: WebSocket):
        # Sends the message to everyone EXCEPT the person who sent it
        for connection in self.active_connections:
            if connection != sender:
                await connection.send_text(message)

manager = ConnectionManager()

# The endpoint the browser connects to for real-time chat
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Wait for a message from the browser
            data = await websocket.receive_text()
            # Immediately broadcast it to the partner
            await manager.broadcast(data, websocket)
    except WebSocketDisconnect:
        # If a user closes the tab or loses connection, remove them
        manager.disconnect(websocket)