let ws, myUsername, secretKey;
let mediaRecorder, audioChunks = [];
let contacts = new Set(JSON.parse(localStorage.getItem('chat_contacts') || '[]'));
let typingTimeout;

// WebRTC Variables
let pc, mediaStream;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- THEME & SETTINGS ---
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-toggle').checked = true;
    }
});
document.getElementById('theme-toggle').onchange = e => {
    document.body.classList.toggle('light-mode', e.target.checked);
    localStorage.setItem('theme', e.target.checked ? 'light' : 'dark');
};
function openSettings() { document.getElementById('settings-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }
function logout() { location.reload(); }

// --- WEBSOCKET LOGIN & ROUTER ---
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value.trim();
    secretKey = document.getElementById("keyInput").value;
    if (!myUsername || !secretKey) return alert("Credentials Required");

    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(`${protocol}${window.location.host}/ws`);
    
    ws.onopen = () => {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-container").style.display = "flex";
        document.querySelector('.my-avatar').innerText = myUsername.charAt(0).toUpperCase();
        contacts.forEach(u => displayContact(u));
    };

    ws.onmessage = async (e) => {
        const dec = await decrypt(e.data, secretKey);
        if (!dec) return;
        const data = JSON.parse(dec);
        
        // --- 1. Handshake logic (Adding Contacts) ---
        if (data.type === 'ping' && data.target === myUsername) {
            encrypt(JSON.stringify({ user: myUsername, type: 'pong', target: data.user }), secretKey).then(enc => ws.send(enc));
            return;
        }
        if (data.type === 'pong' && data.target === myUsername) {
            clearTimeout(pendingAddTimeout);
            if (pendingContact === data.user) completeAddContact(data.user);
            updateStatus(data.user, true);
            return;
        }

        // --- 2. WebRTC Call Signals ---
        if (data.isSignal && data.target === myUsername) {
            handleSignal(data);
            return;
        }

        // --- 3. Chat Messages & Typing ---
        if (data.user !== myUsername && (!data.target || data.target === myUsername || data.target === "all")) {
            if (data.type === "typing") {
                showTyping(data.user);
            } else {
                addContact(data.user);
                updateStatus(data.user, true);
                renderMsg(data.user, data.content, "partner-message", data.time, data.type, data.fname);
                hideTyping(data.user);
            }
        }
    };
};

// --- ADD CONTACT (PING/PONG PROTOCOL) ---
let pendingContact = null;
let pendingAddTimeout = null;

function promptAddContact() {
    if (!myUsername) return alert("Please log in first.");
    const newContact = prompt("Enter the exact username to connect with:");
    if (!newContact || newContact.trim() === "" || newContact.trim() === myUsername) return;
    
    pendingContact = newContact.trim();
    
    // Broadcast a ping to search for the user
    encrypt(JSON.stringify({ user: myUsername, type: 'ping', target: pendingContact }), secretKey).then(enc => ws.send(enc));
    
    // If no pong comes back in 3 seconds, they are offline
    pendingAddTimeout = setTimeout(() => {
        alert(`User '${pendingContact}' is not online or does not exist.`);
        pendingContact = null;
    }, 3000);
}

function completeAddContact(u) {
    addContact(u);
    pendingContact = null;
    document.getElementById(`contact-${u}`).click();
}

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
    item.id = `contact-${u}`;
    const initial = u.charAt(0).toUpperCase();
    
    item.innerHTML = `
        <div class="contact-avatar">${initial}</div>
        <div class="contact-info">
            <div class="contact-row-top">
                <span class="contact-name">${u}</span>
                <span class="status-dot"></span>
            </div>
            <div class="contact-row-bottom" id="subtitle-${u}"></div>
        </div>
    `;
    item.onclick = () => {
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('active-chat-area').style.display = 'flex';
        document.getElementById('active-chat-user').innerText = u;
        document.getElementById('active-chat-avatar').innerText = initial;
        
        // Update "Online" text logic
        const isOnline = item.querySelector('.status-dot').classList.contains('status-online');
        document.getElementById('active-chat-status').innerText = isOnline ? 'Online' : '';
        
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };
    list.appendChild(item);
}

// --- STATUS & TYPING ---
function updateStatus(user, isOnline) {
    const el = document.getElementById(`contact-${user}`);
    if (el) {
        el.querySelector('.status-dot').classList.toggle('status-online', isOnline);
        if (document.getElementById('active-chat-user').innerText === user) {
            document.getElementById('active-chat-status').innerText = isOnline ? 'Online' : '';
        }
    }
}

function sendTypingStatus() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        encrypt(JSON.stringify({ user: myUsername, type: "typing", target: "all" }), secretKey).then(enc => ws.send(enc));
    }
}

function showTyping(user) {
    const subtitle = document.getElementById(`subtitle-${user}`);
    if (subtitle) {
        subtitle.innerHTML = '<span class="typing-indicator">typing...</span>';
        clearTimeout(subtitle.typingTimer);
        subtitle.typingTimer = setTimeout(() => hideTyping(user), 3000);
    }
}

function hideTyping(user) {
    const subtitle = document.getElementById(`subtitle-${user}`);
    if (subtitle) subtitle.innerHTML = '';
}

// Input Swapping logic
document.getElementById('messageInput').addEventListener('input', function() {
    const mic = document.getElementById('recordBtn');
    const snd = document.getElementById('sendBtn');
    if (this.value.trim().length > 0) {
        mic.style.display = 'none'; snd.style.display = 'block';
        clearTimeout(typingTimeout);
        sendTypingStatus();
        typingTimeout = setTimeout(() => {}, 3000);
    } else {
        mic.style.display = 'block'; snd.style.display = 'none';
    }
});

// --- RENDER & SEND MESSAGES (FIXED IMAGES) ---
function renderMsg(user, content, cls, time, type, fname) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    let inner = cls === 'partner-message' ? `<span class="msg-sender">${user}</span>` : '';
    
    if (type === "text") {
        inner += `<span>${content}</span>`;
    } else if (type === "audio") {
        inner += `<audio controls src="${content}"></audio>`;
    } else if (type === "file") {
        // Detect Images and render them natively
        if (content.startsWith('data:image/')) {
            inner += `<img src="${content}" class="chat-image" onclick="window.open('${content}')"><br>`;
        }
        inner += `<a href="${content}" download="${fname}" style="color:var(--accent); font-weight:bold; text-decoration:none;">📄 Download ${fname}</a>`;
    }
    
    div.innerHTML = `${inner}<div class="timestamp">${time}</div>`;
    const m = document.getElementById("messages");
    m.appendChild(div);
    m.scrollTop = m.scrollHeight;
}

async function send(content, type="text", fname="") {
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const payload = JSON.stringify({user:myUsername, content, type, time, fname, target:"all"});
    const enc = await encrypt(payload, secretKey);
    ws.send(enc);
    renderMsg("You", content, "my-message", time, type, fname);
}

// --- CALL BUTTON (WEBRTC) ---
document.getElementById('callBtn').onclick = async () => {
    const target = document.getElementById('active-chat-user').innerText;
    if (!target) return alert("Select a contact to call.");
    
    document.getElementById("video-container").style.display = "flex";
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        document.getElementById("localVideo").srcObject = mediaStream;
        
        pc = new RTCPeerConnection(config);
        mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));
        
        pc.onicecandidate = e => e.candidate && sendSignal({type:"candidate", candidate:e.candidate, target});
        pc.ontrack = e => document.getElementById("remoteVideo").srcObject = e.streams[0];
        
        const off = await pc.createOffer();
        await pc.setLocalDescription(off);
        sendSignal({type:"offer", offer:off, target});
    } catch (e) { alert("Camera/Mic access denied!"); document.getElementById("video-container").style.display = "none"; }
};

async function handleSignal(d) {
    if (d.type === "offer") {
        if (!confirm(`Incoming video call from ${d.user}. Answer?`)) {
            sendSignal({ type: "hangup", target: d.user });
            return;
        }
        document.getElementById("video-container").style.display = "flex";
        mediaStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        document.getElementById("localVideo").srcObject = mediaStream;
        
        pc = new RTCPeerConnection(config);
        mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));
        pc.onicecandidate = e => e.candidate && sendSignal({type:"candidate", candidate:e.candidate, target: d.user});
        pc.ontrack = e => document.getElementById("remoteVideo").srcObject = e.streams[0];
        
        await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        sendSignal({type:"answer", answer:ans, target: d.user});
    } else if (d.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
    } else if (d.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(d.candidate));
    } else if (d.type === "hangup") {
        endCall(false);
        alert(`${d.user} ended the call.`);
    }
}

function sendSignal(s) {
    s.isSignal = true; s.user = myUsername;
    encrypt(JSON.stringify(s), secretKey).then(enc => ws.send(enc));
}

document.getElementById('hangupBtn').onclick = () => endCall(true);
function endCall(notify=true) {
    const target = document.getElementById('active-chat-user').innerText;
    if (notify && target) sendSignal({type:"hangup", target});
    if (pc) pc.close();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    document.getElementById("video-container").style.display = "none";
}

// --- STANDARD CONTROLS ---
document.getElementById("sendBtn").onclick = () => {
    const i = document.getElementById("messageInput");
    if(i.value.trim()) { send(i.value.trim()); i.value = ""; document.getElementById('recordBtn').style.display = 'block'; document.getElementById('sendBtn').style.display = 'none';}
};
document.getElementById("messageInput").onkeydown = (e) => { if(e.key === "Enter") document.getElementById("sendBtn").click(); };
document.getElementById("attachBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = (e) => {
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onloadend = () => send(r.result, "file", f.name);
    r.readAsDataURL(f);
};

document.getElementById("recordBtn").onclick = async function() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        this.classList.remove("recording-active");
    } else {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(s);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const b = new Blob(audioChunks, { type: 'audio/webm' });
                const r = new FileReader();
                r.onloadend = () => send(r.result, "audio");
                r.readAsDataURL(b);
                s.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            this.classList.add("recording-active");
        } catch (err) { alert("Mic denied."); }
    }
};