let ws, myUsername, secretKey, pc, mediaStream, mediaRecorder, audioChunks = [];
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let contacts = new Set(JSON.parse(localStorage.getItem('chat_contacts') || '[]'));

// --- UI HELPERS ---
function openSettings() { document.getElementById('settings-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }
function clearStorage() { localStorage.clear(); location.reload(); }

// --- THEME & STARTUP ---
window.onload = () => {
    contacts.forEach(u => displayContact(u));
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-toggle').checked = false;
    }
};

document.getElementById('theme-toggle').onchange = (e) => {
    const isDark = e.target.checked;
    document.body.classList.toggle('light-mode', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// --- CORE WS LOGIC ---
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value || "User";
    secretKey = document.getElementById("keyInput").value;
    if (!secretKey) return alert("Key Required");
    
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
        else {
            if (data.user !== myUsername) addContact(data.user);
            renderMsg(data.user, data.content, data.user === myUsername ? "my-message" : "partner-message", data.time, data.type, data.fname);
        }
    };
};

function addContact(u) {
    if (contacts.has(u)) return;
    contacts.add(u);
    localStorage.setItem('chat_contacts', JSON.stringify([...contacts]));
    displayContact(u);
}

function displayContact(u) {
    const list = document.getElementById('contact-list');
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = `<div style="width:30px;height:30px;background:#555;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">${u[0].toUpperCase()}</div> <span>${u}</span>`;
    item.onclick = () => {
        document.getElementById('active-chat-user').innerText = u;
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };
    list.appendChild(item);
}

// --- RENDERING & PREVIEWS ---
function renderMsg(user, content, cls, time, type, fname) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    let inner = `<strong>${user}</strong><br>`;
    
    if (type === "text") inner += content;
    else if (type === "audio") inner += `<audio controls src="${content}" style="width:100%;margin-top:5px;"></audio>`;
    else if (type === "file") {
        const mime = content.split(';')[0].split(':')[1];
        if (mime.startsWith('image/')) inner += `<img src="${content}" class="chat-preview" onclick="window.open('${content}')">`;
        else if (mime.startsWith('video/')) inner += `<video controls src="${content}" class="chat-preview"></video>`;
        else if (mime === 'application/pdf') inner += `<embed src="${content}" type="application/pdf" class="chat-preview">`;
        inner += `<div class="file-link-box"><a href="${content}" download="${fname}">📥 Download ${fname}</a></div>`;
    }
    
    div.innerHTML = `${inner}<div style="font-size:10px;opacity:0.5;text-align:right;margin-top:4px;">${time}</div>`;
    document.getElementById("messages").appendChild(div);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}

// --- SENDING ---
async function send(content, type="text", fname="") {
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const enc = await encrypt(JSON.stringify({user:myUsername, content, type, time, fname}), secretKey);
    ws.send(enc);
    renderMsg(myUsername, content, "my-message", time, type, fname);
}

// --- RECORDING ---
document.getElementById("recordBtn").onclick = async function() {
    if (mediaRecorder?.state === "recording") {
        mediaRecorder.stop();
        this.classList.remove("recording-active");
    } else {
        const s = await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder = new MediaRecorder(s);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const r = new FileReader();
            r.onloadend = () => send(r.result, "audio");
            r.readAsDataURL(new Blob(audioChunks));
            s.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        this.classList.add("recording-active");
    }
};

// --- ATTACHMENTS ---
document.getElementById("attachBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = (e) => {
    const f = e.target.files[0];
    const r = new FileReader();
    r.onloadend = () => send(r.result, "file", f.name);
    r.readAsDataURL(f);
};

// --- VIDEO CALLS (WebRTC) ---
async function startCall() {
    document.getElementById("video-container").style.display = "flex";
    mediaStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    document.getElementById("localVideo").srcObject = mediaStream;
    pc = new RTCPeerConnection(config);
    mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));
    pc.onicecandidate = e => e.candidate && sendSignal({type:"candidate", candidate:e.candidate});
    pc.ontrack = e => document.getElementById("remoteVideo").srcObject = e.streams[0];
    const off = await pc.createOffer(); await pc.setLocalDescription(off);
    sendSignal({type:"offer", offer:off});
}
async function handleSignal(d) {
    if (d.type === "offer") {
        if (!confirm(`Call from ${d.user}?`)) return;
        await startCall(); await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
        const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
        sendSignal({type:"answer", answer:ans});
    } else if (d.type === "answer") await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
    else if (d.type === "candidate") await pc.addIceCandidate(new RTCIceCandidate(d.candidate));
    else if (d.type === "hangup") endCall(false);
}
function endCall(n=true) {
    if(n) sendSignal({type:"hangup"});
    if(pc) pc.close();
    if(mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    document.getElementById("video-container").style.display = "none";
}
function sendSignal(s) { s.isSignal=true; s.user=myUsername; encrypt(JSON.stringify(s), secretKey).then(e => ws.send(e)); }

// Event Handlers
document.getElementById("sendBtn").onclick = () => { const i = document.getElementById("messageInput"); if(i.value) { send(i.value); i.value = ""; } };
document.getElementById("messageInput").onkeydown = (e) => e.key === "Enter" && document.getElementById("sendBtn").click();
document.getElementById("callBtn").onclick = startCall;
document.getElementById("hangupBtn").onclick = () => endCall(true);
