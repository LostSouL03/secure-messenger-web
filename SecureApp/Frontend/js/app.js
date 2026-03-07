let ws, myUsername, secretKey, pc, mediaStream;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- LOGIN ACTION ---
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value.trim() || "User";
    secretKey = document.getElementById("keyInput").value;
    
    if (!secretKey) {
        alert("Enter a Secret Key!");
        return;
    }

    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    const wsUrl = `${protocol}${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        // Switch screens
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-container").style.display = "flex";
    };

    ws.onmessage = async (e) => {
        const dec = await decrypt(e.data, secretKey);
        if (!dec) return;
        const data = JSON.parse(dec);
        if (data.isSignal) handleSignal(data);
        else renderMessage(data.user, data.content, "partner-message", data.time);
    };
};

// --- CHAT FUNCTIONS ---
async function sendTextMessage() {
    const input = document.getElementById("messageInput");
    if (!input.value.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = { user: myUsername, content: input.value, type: "text", time };
    const enc = await encrypt(JSON.stringify(payload), secretKey);
    ws.send(enc);
    renderMessage("You", input.value, "my-message", time);
    input.value = "";
}

function renderMessage(user, content, className, time) {
    const div = document.createElement("div");
    div.className = `message ${className}`;
    div.innerHTML = `<strong>${user}</strong><br>${content}<div style="font-size:10px; opacity:0.5; text-align:right;">${time}</div>`;
    document.getElementById("messages").appendChild(div);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}

// --- CALL FUNCTIONS ---
const callBtn = document.getElementById('callBtn');
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
    mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));
    pc.onicecandidate = e => { if (e.candidate) sendSignal({ type: "candidate", candidate: e.candidate }); };
    pc.ontrack = e => { document.getElementById("remoteVideo").srcObject = e.streams[0]; };
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
}

function sendSignal(signal) {
    signal.user = myUsername; signal.isSignal = true;
    encrypt(JSON.stringify(signal), secretKey).then(enc => ws.send(enc));
}

// Bindings
document.getElementById("sendBtn").onclick = sendTextMessage;
document.getElementById("hangupBtn").onclick = () => endCall(true);
document.getElementById("messageInput").onkeypress = (e) => { if(e.key === "Enter") sendTextMessage(); };
