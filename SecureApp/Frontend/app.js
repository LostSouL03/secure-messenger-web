let ws, myUsername, secretKey, pc, mediaStream, mediaRecorder, audioChunks = [];
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- 1. LOGIN & WS CONNECTION ---
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value || "User";
    secretKey = document.getElementById("keyInput").value;
    if (!secretKey) return alert("Secret Key is required!");

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
        else renderMsg(data.user, data.content, "partner-message", data.time, data.type, data.fname);
    };
};

// --- 2. MESSAGING FUNCTIONS ---
async function sendPayload(content, type = "text", fname = "") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = JSON.stringify({ user: myUsername, content, type, time, fname });
    const enc = await encrypt(payload, secretKey);
    ws.send(enc);
    renderMsg("You", content, "my-message", time, type, fname);
}

function renderMsg(user, content, cls, time, type, fname) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    let inner = `<strong>${user}</strong><br>`;
    
    if (type === "text") inner += content;
    else if (type === "audio") inner += `<audio controls src="${content}" style="width:200px"></audio>`;
    else if (type === "file") inner += `<a href="${content}" download="${fname}" style="color:#00a884">📄 ${fname}</a>`;
    
    div.innerHTML = `${inner}<div style="font-size:10px; opacity:0.5; text-align:right;">${time}</div>`;
    document.getElementById("messages").appendChild(div);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}

// --- 3. VOICE RECORDING ---
document.getElementById("recordBtn").onclick = async function() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        this.classList.remove("recording-active");
    } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const reader = new FileReader();
            reader.onloadend = () => sendPayload(reader.result, "audio");
            reader.readAsDataURL(new Blob(audioChunks));
        };
        mediaRecorder.start();
        this.classList.add("recording-active");
    }
};

// --- 4. FILE SHARING ---
document.getElementById("attachBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => sendPayload(reader.result, "file", file.name);
    reader.readAsDataURL(file);
};

// --- 5. VIDEO CALLING ---
async function startCall() {
    document.getElementById("video-container").style.display = "flex";
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = mediaStream;
    pc = new RTCPeerConnection(config);
    mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));
    pc.onicecandidate = e => e.candidate && sendSignal({ type: "candidate", candidate: e.candidate });
    pc.ontrack = e => document.getElementById("remoteVideo").srcObject = e.streams[0];
    const off = await pc.createOffer(); await pc.setLocalDescription(off);
    sendSignal({ type: "offer", offer: off });
}

async function handleSignal(d) {
    if (d.type === "offer") {
        if (confirm("Answer incoming call?")) {
            await startCall();
            await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
            const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
            sendSignal({ type: "answer", answer: ans });
        }
    } else if (d.type === "answer") await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
    else if (d.type === "candidate") await pc.addIceCandidate(new RTCIceCandidate(d.candidate));
    else if (d.type === "hangup") endCall(false);
}

function endCall(notify = true) {
    if (notify) sendSignal({ type: "hangup" });
    if (pc) pc.close();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    document.getElementById("video-container").style.display = "none";
}

function sendSignal(s) { s.isSignal = true; s.user = myUsername; encrypt(JSON.stringify(s), secretKey).then(e => ws.send(e)); }

// Events
document.getElementById("sendBtn").onclick = () => {
    const i = document.getElementById("messageInput");
    if(i.value.trim()) { sendPayload(i.value.trim()); i.value = ""; }
};
document.getElementById("messageInput").onkeydown = (e) => e.key === "Enter" && document.getElementById("sendBtn").click();
document.getElementById("callBtn").onclick = startCall;
document.getElementById("hangupBtn").onclick = () => endCall(true);