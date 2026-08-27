# Secure Messenger Web 🔐

A browser-based real-time messaging application built with **HTML, CSS, JavaScript, FastAPI, and WebSockets**.

The application was developed as a hands-on web development project exploring real-time communication, client-side encryption, browser APIs, responsive UI design, and peer-to-peer video communication.

> **Note:** This is a portfolio/learning project. The encryption implementation demonstrates client-side encrypted messaging but has not undergone an independent security audit and should not be used for highly sensitive communications.

## ✨ Features

* 🔐 Client-side message encryption using the **Web Crypto API**
* 💬 Real-time messaging using **WebSockets**
* 👤 Username-based contacts and online status
* ✍️ Typing indicators
* ✓ Read receipts
* 📎 File and image sharing
* 🎤 Voice message recording
* 📹 Peer-to-peer video calling using **WebRTC**
* 🔔 Browser notifications for incoming messages
* 💾 Local chat history using `localStorage`
* 🌓 Dark and light themes
* 📱 Responsive chat interface
* 🔒 Encrypted WebSocket communication
* 🔗 Contact discovery through an encrypted ping/pong handshake

## 🛠️ Tech Stack

### Frontend

* **HTML5** — application structure
* **CSS3** — responsive interface and theming
* **JavaScript** — application logic and browser APIs
* **Web Crypto API** — AES-GCM encryption/decryption
* **WebSocket API** — real-time communication
* **WebRTC** — peer-to-peer video/audio calls
* **MediaRecorder API** — voice message recording
* **Notifications API** — browser notifications
* **localStorage** — local contacts, chat history, and preferences

### Backend

* **Python**
* **FastAPI** — web application and WebSocket server
* **Uvicorn** — ASGI server
* **WebSockets** — real-time message relay

## 🏗️ Architecture

The application uses a lightweight client-server architecture.

```text
┌──────────────────────────────┐
│          Browser             │
│                              │
│  HTML / CSS / JavaScript     │
│                              │
│  ┌────────────────────────┐  │
│  │ Web Crypto API         │  │
│  │ AES-GCM encryption     │  │
│  └────────────────────────┘  │
│                              │
│  WebSocket + WebRTC          │
└──────────────┬───────────────┘
               │
          Encrypted data
               │
               ▼
┌──────────────────────────────┐
│       FastAPI Backend        │
│                              │
│  WebSocket connection        │
│  management + message relay  │
└──────────────────────────────┘
```

The browser encrypts application messages before sending them through the WebSocket connection. The FastAPI backend primarily acts as a real-time relay, forwarding the encrypted payloads between connected clients.

Video calls use WebRTC for peer-to-peer media communication, with the WebSocket connection used to exchange the signalling information required to establish the connection.

## 🔐 Encryption

The project uses the browser's **Web Crypto API** to encrypt message payloads with **AES-GCM**.

The encryption flow is:

```text
Secret Key
    │
    ▼
SHA-256
    │
    ▼
AES-GCM Key
    │
    ▼
Message / Payload
    │
    ▼
Random 12-byte IV
    │
    ▼
Encrypted Base64 Payload
    │
    ▼
WebSocket
```

A new random initialization vector is generated for each encryption operation. The IV is combined with the encrypted payload so that the recipient can use it during decryption.

The backend does not perform the message encryption or decryption. It receives the encrypted payload and broadcasts it to connected clients.

## 📁 Project Structure

```text
secure-messenger-web/
│
├── SecureApp/
│   │
│   ├── Backend/
│   │   └── main.py
│   │
│   ├── Frontend/
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── app.js
│   │   └── encryption.js
│   │
│   └── requirements.txt
│
├── README.md
└── requirements.txt
```

### Backend

`Backend/main.py`

Responsible for:

* Creating the FastAPI application
* Managing WebSocket connections
* Accepting incoming encrypted messages
* Broadcasting encrypted payloads to connected clients
* Serving the frontend application
* Starting the Uvicorn server

### Frontend

`Frontend/index.html`

Contains the application's main UI, including:

* Login screen
* Contact sidebar
* Chat window
* Message input
* File attachment controls
* Voice recording controls
* Video call interface
* Settings panel

`Frontend/app.js`

Contains the main application logic, including:

* WebSocket communication
* Contact management
* Chat history
* Typing indicators
* Read receipts
* Browser notifications
* File sharing
* Voice recording
* Theme switching
* WebRTC video calling

`Frontend/encryption.js`

Contains the client-side AES-GCM encryption and decryption functions using the Web Crypto API.

`Frontend/styles.css`

Contains the application's visual styling, layout, responsive behaviour, themes, chat components, login screen, settings interface, and call interface.

## 🚀 Getting Started

### Prerequisites

* Python 3.x
* A modern web browser with support for:

  * Web Crypto API
  * WebSockets
  * WebRTC
  * MediaRecorder API

### 1. Clone the repository

```bash
git clone https://github.com/masfia-dev/secure-messenger-web.git
cd secure-messenger-web
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

The project uses:

```text
fastapi
uvicorn
websockets
```

### 3. Start the server

Navigate to the backend directory:

```bash
cd SecureApp/Backend
```

Then start the application:

```bash
python main.py
```

The server runs on port `8000` by default.

Open your browser and visit:

```text
http://localhost:8000
```

## 💬 Using the Application

### 1. Log in

Enter a username and secret key on the login screen.

The application stores the account identifier and secret locally in the browser using `localStorage`.

### 2. Add a contact

Use the **New Chat** button and enter another user's username.

The application sends an encrypted ping through the WebSocket connection to determine whether the user is currently connected.

### 3. Send messages

Select a contact and type a message.

Before the message is sent, the message payload is encrypted in the browser and then transmitted through the WebSocket connection.

### 4. Share media

The application supports:

* Text messages
* Images
* Files
* Recorded voice messages

Files are read in the browser and transmitted as data URLs, while voice messages are recorded using the browser's `MediaRecorder` API.

### 5. Make a video call

Select a contact and use the call button.

The application uses:

* `getUserMedia()` for camera and microphone access
* `RTCPeerConnection` for the WebRTC connection
* ICE candidates for connection establishment
* WebSocket signalling for exchanging offers, answers, and candidates

## 🎨 Interface

The application includes:

* Dark mode
* Light mode
* Contact search
* Online status indicators
* Typing indicators
* Read receipts
* Message timestamps
* Browser notifications
* Responsive chat layout

User preferences such as the selected theme and chat data are stored locally in the browser.

## 🧠 What I Learned

This project helped me develop practical experience across both frontend and backend development.

### Frontend Development

* Building a complete web interface with HTML and CSS
* Managing application state with JavaScript
* Creating interactive UI components
* Working with browser APIs
* Handling user input and media
* Building responsive layouts
* Managing persistent client-side data

### Real-Time Applications

* Establishing WebSocket connections
* Handling asynchronous events
* Broadcasting messages between clients
* Implementing typing indicators and read receipts
* Managing connection and user status

### Web Security

* Understanding client-side encryption
* Working with the Web Crypto API
* Using AES-GCM encryption
* Generating random initialization vectors
* Considering the difference between encrypted transport and a complete end-to-end encryption architecture

### WebRTC

* Working with camera and microphone permissions
* Creating peer-to-peer connections
* Handling WebRTC signalling
* Managing ICE candidates
* Streaming audio and video between browsers

### Backend Development

* Building an API server with FastAPI
* Managing WebSocket connections
* Serving static frontend files
* Handling asynchronous Python code
* Running an application with Uvicorn

## 🔍 Key Technical Challenges

### Real-Time Communication

One of the main challenges was coordinating communication between multiple connected browsers.

The FastAPI backend maintains a collection of active WebSocket connections and broadcasts incoming encrypted payloads to connected clients.

### Client-Side Encryption

Another challenge was implementing encryption directly in the browser rather than relying on the backend to encrypt messages.

The application derives an AES-GCM key from the user's secret key and performs encryption/decryption using the Web Crypto API.

### WebRTC Signalling

Video calling required a separate signalling layer to exchange WebRTC offers, answers, ICE candidates, and call termination events.

I implemented this signalling through the existing encrypted WebSocket channel before allowing WebRTC to establish the media connection.

## 🚧 Future Improvements

Potential improvements for future versions include:

* Improving the authentication architecture
* Moving account/session management away from browser `localStorage`
* Adding a dedicated database
* Improving key management
* Adding automated tests
* Improving accessibility
* Adding stronger input validation
* Improving error handling and reconnection behaviour
* Adding message delivery states
* Improving mobile UI
* Introducing a more robust end-to-end encryption protocol
* Adding deployment documentation
* Adding CI/CD through GitHub Actions

## ⚠️ Security Considerations

This project is intended for **learning and portfolio purposes**.

Although messages are encrypted in the browser using AES-GCM, the project does not implement a complete production-grade end-to-end encryption protocol with modern key exchange, forward secrecy, identity verification, or independent security auditing.

The application should therefore **not be used for genuinely sensitive or confidential communications**.

## 📚 Project Purpose

This project was created to gain practical experience building a complete web application from the frontend through to the backend.

It combines several areas of web development in one project:

**Frontend UI → JavaScript → Web Crypto → WebSockets → FastAPI → WebRTC**

The project demonstrates my interest in building interactive web applications while exploring real-time communication and web security.

## 👩‍💻 Author

**Masfia**

GitHub: [@masfia-dev](https://github.com/masfia-dev)
