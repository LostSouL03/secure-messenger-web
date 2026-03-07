let ws, myUsername, secretKey, pc, mediaStream;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- LOGIN & SCREEN SWITCHING ---
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value.trim() || "User";
    secretKey = document.getElementById("keyInput").value;
    
    if (!secretKey) {
        alert("Secret Auth Key is required for end-to-end encryption.");
        return;
    }

    // Connect to WebSocket
    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(`${protocol}${window.location.host}/ws`);
    
    ws.onopen = () => {
        console.log("Connected to Secure Relay");
        // HIDE LOGIN, SHOW CHAT
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-container").style.display = "flex";
    };

    ws.onmessage = async (e) => {
        const dec = await decrypt(e.data, secretKey);
        if (!dec) return;
        const data = JSON.parse(dec);
        
        if (data.isSignal) {
            handleSignal(data);
        } else {
            renderMessage(data.user, data.content, "partner-message", data.time);
        }
    };
};

// --- MESSAGING ---
async function sendTextMessage() {
    const input = document.getElementById("messageInput");
    const txt = input.value.trim();
    if (!txt) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = { user: myUsername, content: txt, type: "text", time };
    
    // Encrypt before sending
    const enc = await encrypt(JSON.stringify(payload), secretKey);
    ws.send(enc);
    
    renderMessage("You", txt, "my-message", time);
    input.value = "";
}

function renderMessage(user, content, className, time) {
    const container = document.getElementById("messages");
    const div = document.createElement("div");
    div.className = `message ${className}`;
    div.innerHTML = `<strong>${user}</strong><br>${content}<div style="font-size:10px; opacity:0.5; text-align:right;">${time}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// --- WEBRTC VIDEO CALLS ---
const callBtn = document.getElementById('callBtn');

callBtn.onclick = async () => {
    // If already in call, just show the video overlay again
    if (callBtn.classList.contains("active-call")) {
        document.getElementById("video-container").style.display = "flex";
    } else {
        startCall();
    }
};

async function startCall() {
    // UI Update
    callBtn.innerText = "📞 In Call";
    callBtn.classList.add("active-call");
    document.getElementById("video-container").style.display = "flex";

    // Media Setup
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = mediaStream;

    pc = new RTCPeerConnection(config);
    mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));

    pc.onicecandidate = e => { 
        if (e.candidate) sendSignal({ type: "candidate", candidate: e.candidate }); 
    };
    pc.ontrack = e => { 
        document.getElementById("remoteVideo").srcObject = e.streams[0]; 
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ type: "offer", offer });
}

async function handleSignal(data) {
    if (data.type === "offer") {
        if (!confirm(`${data.user} is calling. Answer?`)) return;
        await startCall();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "answer", answer });
    } else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else if (data.type === "hangup") {
        endCall(false);
    }
}

function endCall(notify = true) {
    if (notify) sendSignal({ type: "hangup" });
    
    callBtn.innerText = "📞 Start Call";
    callBtn.classList.remove("active-call");
    
    if (pc) pc.close();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    
    document.getElementById("video-container").style.display = "none";
    pc = null;
}

function sendSignal(signal) {
    signal.user = myUsername; 
    signal.isSignal = true;
    encrypt(JSON.stringify(signal), secretKey).then(enc => ws.send(enc));
}

// --- BUTTON BINDINGS ---
document.getElementById("sendBtn").onclick = sendTextMessage;
document.getElementById("hangupBtn").onclick = () => endCall(true);
document.getElementById("messageInput").onkeypress = (e) => { if(e.key === "Enter") sendTextMessage(); };
