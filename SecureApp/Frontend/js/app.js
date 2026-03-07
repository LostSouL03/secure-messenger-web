let ws, myUsername, secretKey, pc, mediaStream, mediaRecorder, audioChunks = [];
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// UI Elements
const loginBtn = document.getElementById('loginBtn');
const callBtn = document.getElementById('callBtn');
const messageInput = document.getElementById('messageInput');

// Theme Switcher
document.getElementById('theme-toggle').onclick = () => {
    const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
};
document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');

// Start Session
loginBtn.onclick = () => {
    myUsername = document.getElementById("usernameInput").value.trim() || "User";
    secretKey = document.getElementById("keyInput").value;
    if (!secretKey) return alert("Key required");

    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(`${protocol}${window.location.host}/ws`);
    
    ws.onopen = () => {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-container").style.display = "flex";
    };

    ws.onmessage = async (e) => {
        const dec = await decrypt(e.data, secretKey);
        if (!dec) return;
        const data = JSON.parse(dec);
        if (data.isSignal) handleSignal(data);
        else renderMessage(data.user, data.content, "partner-message", data.time, data.type, data.filename);
    };
};

// Messaging logic
async function sendTextMessage() {
    const txt = messageInput.value.trim();
    if (!txt) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const enc = await encrypt(JSON.stringify({ user: myUsername, content: txt, type: "text", time }), secretKey);
    ws.send(enc);
    renderMessage("You", txt, "my-message", time, "text");
    messageInput.value = "";
}

function renderMessage(user, content, className, time, type, filename) {
    const div = document.createElement("div");
    div.className = `message ${className}`;
    let body = `<strong>${user}:</strong> `;
    if (type === "text") body += content;
    else if (type === "audio") body += `<br><audio controls src="${content}"></audio>`;
    div.innerHTML = `${body} <span style="font-size:0.7em; opacity:0.5; margin-left:8px;">${time}</span>`;
    document.getElementById("messages").appendChild(div);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}

// Call Logic
callBtn.onclick = async () => {
    if (callBtn.classList.contains("active-call")) {
        document.getElementById("video-container").style.display = "flex";
    } else {
        startCall();
    }
};

async function startCall() {
    callBtn.innerText = "📞 In Call";
    callBtn.classList.add("active-call");
    document.getElementById("video-container").style.display = "flex";
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = mediaStream;
    pc = new RTCPeerConnection(config);
    mediaStream.getTracks().forEach(track => pc.addTrack(track, mediaStream));
    pc.onicecandidate = e => { if (e.candidate) sendSignal({ type: "candidate", candidate: e.candidate }); };
    pc.ontrack = e => { document.getElementById("remoteVideo").srcObject = e.streams[0]; };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ type: "offer", offer });
}

async function handleSignal(data) {
    if (data.type === "offer") {
        if (!confirm(`${data.user} is calling. Answer?`)) return;
        startCall(); // Re-use startCall for answering
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "answer", answer });
    } 
    else if (data.type === "answer") await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    else if (data.type === "candidate") await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    else if (data.type === "hangup") endCall(false);
}

function endCall(notify = true) {
    if (notify) sendSignal({ type: "hangup" });
    callBtn.innerText = "📞 Start Call";
    callBtn.classList.remove("active-call");
    if (pc) pc.close();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    document.getElementById("video-container").style.display = "none";
}

function sendSignal(signal) {
    signal.user = myUsername; signal.isSignal = true;
    encrypt(JSON.stringify(signal), secretKey).then(enc => ws.send(enc));
}

document.getElementById("hangupBtn").onclick = () => endCall(true);
document.getElementById("sendBtn").onclick = sendTextMessage;
messageInput.onkeypress = (e) => { if (e.key === "Enter") sendTextMessage(); };
