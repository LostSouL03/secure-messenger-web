let ws, myUsername, secretKey;
let mediaRecorder, audioChunks = [];
let contacts = new Set(JSON.parse(localStorage.getItem('chat_contacts') || '[]'));

// --- THEME & SETUP ---
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-toggle').checked = true;
    }
});

document.getElementById('theme-toggle').onchange = (e) => {
    const isLight = e.target.checked;
    document.body.classList.toggle('light-mode', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
};

function logout() { location.reload(); }
function openSettings() { document.getElementById('settings-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }

// --- LOGIN ---
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value.trim();
    secretKey = document.getElementById("keyInput").value;
    if (!myUsername || !secretKey) return alert("Credentials Required");

    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(`${protocol}${window.location.host}/ws`);
    
    ws.onopen = () => {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-container").style.display = "flex";
        contacts.forEach(u => displayContact(u));
    };

    ws.onmessage = async (e) => {
        const dec = await decrypt(e.data, secretKey);
        if (!dec) return;
        const data = JSON.parse(dec);
        if (data.user !== myUsername) {
            addContact(data.user);
            updateStatus(data.user, true);
            renderMsg(data.user, data.content, "partner-message", data.time, data.type, data.fname);
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
    item.id = `contact-${u}`;
    item.innerHTML = `<span class="status-dot"></span><span>${u}</span>`;
    item.onclick = () => {
        document.getElementById('active-chat-user').innerText = u;
        document.getElementById('callBtn').style.display = 'block';
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };
    list.appendChild(item);
}

function updateStatus(user, isOnline) {
    const el = document.getElementById(`contact-${user}`);
    if (el) el.querySelector('.status-dot').classList.toggle('status-online', isOnline);
}

// --- MESSAGING ---
function renderMsg(user, content, cls, time, type, fname) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    let inner = `<strong>${user}</strong><br>`;
    if (type === "text") inner += content;
    else if (type === "audio") inner += `<audio controls src="${content}"></audio>`;
    else if (type === "file") inner += `<a href="${content}" download="${fname}" style="color:var(--accent); font-weight:bold; text-decoration:none;">📄 ${fname}</a>`;
    
    div.innerHTML = `${inner}<div style="font-size:10px; opacity:0.5; text-align:right; margin-top:4px;">${time}</div>`;
    const m = document.getElementById("messages");
    m.appendChild(div);
    m.scrollTop = m.scrollHeight;
}

async function send(content, type="text", fname="") {
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const enc = await encrypt(JSON.stringify({user:myUsername, content, type, time, fname}), secretKey);
    ws.send(enc);
    renderMsg("You", content, "my-message", time, type, fname);
}

// --- CONTROLS ---
document.getElementById('contactSearch').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.contact-item').forEach(it => {
        it.style.display = it.innerText.toLowerCase().includes(term) ? 'flex' : 'none';
    });
};

document.getElementById("attachBtn").onclick = () => document.getElementById("fileInput").click();
document.getElementById("fileInput").onchange = (e) => {
    const f = e.target.files[0];
    const r = new FileReader();
    r.onloadend = () => send(r.result, "file", f.name);
    r.readAsDataURL(f);
};

document.getElementById("recordBtn").onclick = async function() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        this.classList.remove("recording-active");
    } else {
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
    }
};

// --- TYPING INDICATORS ---
let typingTimeout;
function sendTypingStatus() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Send a specialized 'typing' packet
        encrypt(JSON.stringify({ user: myUsername, type: "typing" }), secretKey).then(enc => {
            ws.send(enc);
        });
    }
}

// Add this into your existing messageInput onkeydown/input logic
document.getElementById("messageInput").oninput = () => {
    clearTimeout(typingTimeout);
    sendTypingStatus();
    typingTimeout = setTimeout(() => {
        // Stop typing status after 3 seconds of no input
    }, 3000);
};

// Update your ws.onmessage logic to handle the 'typing' type
ws.onmessage = async (e) => {
    const dec = await decrypt(e.data, secretKey);
    if (!dec) return;
    const data = JSON.parse(dec);

    if (data.user !== myUsername) {
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

function showTyping(user) {
    const el = document.getElementById(`contact-${user}`);
    if (el) {
        let typingNode = el.querySelector('.typing-indicator');
        if (!typingNode) {
            typingNode = document.createElement('small');
            typingNode.className = 'typing-indicator';
            typingNode.style.color = 'var(--accent)';
            typingNode.style.display = 'block';
            typingNode.innerText = 'typing...';
            el.appendChild(typingNode);
        }
        // Auto-remove after a few seconds if no more signals come
        clearTimeout(el.typingTimer);
        el.typingTimer = setTimeout(() => hideTyping(user), 4000);
    }
}

function hideTyping(user) {
    const el = document.getElementById(`contact-${user}`);
    if (el) {
        const typingNode = el.querySelector('.typing-indicator');
        if (typingNode) typingNode.remove();
    }
}

document.getElementById("sendBtn").onclick = () => {
    const i = document.getElementById("messageInput");
    if(i.value.trim()) { send(i.value.trim()); i.value = ""; }
};
document.getElementById("messageInput").onkeydown = (e) => { if(e.key === "Enter") document.getElementById("sendBtn").click(); };

