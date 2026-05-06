let ws, myUsername, secretKey;
let mediaRecorder, audioChunks = [];
let contacts = new Set(JSON.parse(localStorage.getItem('chat_contacts') || '[]'));
let typingTimeout;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-toggle').checked = true;
    }
});

// --- UI & SETTINGS HANDLERS ---
document.getElementById('theme-toggle').onchange = (e) => {
    const isLight = e.target.checked;
    document.body.classList.toggle('light-mode', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
};

function openSettings() { document.getElementById('settings-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }
function logout() { location.reload(); }

// --- THE FIX: ADD CONTACT FUNCTION ---
function promptAddContact() {
    if (!myUsername) {
        alert("Please log in first to add contacts.");
        return;
    }
    
    const newContact = prompt("Enter the exact username of the person you want to chat with:");
    
    if (newContact && newContact.trim() !== "") {
        const cleanName = newContact.trim();
        
        if (cleanName === myUsername) {
            alert("You cannot add yourself.");
            return;
        }
        
        addContact(cleanName);
        
        // Automatically open the chat with them
        const newContactEl = document.getElementById(`contact-${cleanName}`);
        if (newContactEl) {
            newContactEl.click();
        }
    }
}

// Dynamic Input Buttons (Mic vs Send)
document.getElementById('messageInput').addEventListener('input', function() {
    const micBtn = document.getElementById('recordBtn');
    const sendBtn = document.getElementById('sendBtn');
    if (this.value.trim().length > 0) {
        micBtn.style.display = 'none';
        sendBtn.style.display = 'block';
        
        clearTimeout(typingTimeout);
        sendTypingStatus();
        typingTimeout = setTimeout(() => {}, 3000);
    } else {
        micBtn.style.display = 'block';
        sendBtn.style.display = 'none';
    }
});

// --- WEBSOCKET LOGIN ---
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
        document.querySelector('.my-avatar').style.display = 'flex';
        document.querySelector('.my-avatar').style.alignItems = 'center';
        document.querySelector('.my-avatar').style.justifyContent = 'center';
        document.querySelector('.my-avatar').style.color = 'white';
        document.querySelector('.my-avatar').style.fontWeight = 'bold';
        
        contacts.forEach(u => displayContact(u));
    };

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
};

// --- CONTACTS & SIDEBAR ---
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
        
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };
    list.appendChild(item);
}

// --- TYPING & STATUS ---
function sendTypingStatus() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        encrypt(JSON.stringify({ user: myUsername, type: "typing" }), secretKey).then(enc => ws.send(enc));
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

function updateStatus(user, isOnline) {
    const el = document.getElementById(`contact-${user}`);
    if (el) el.querySelector('.status-dot').classList.toggle('status-online', isOnline);
}

document.getElementById('contactSearch').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.contact-item').forEach(it => {
        const name = it.querySelector('.contact-name').innerText.toLowerCase();
        it.style.display = name.includes(term) ? 'flex' : 'none';
    });
};

// --- MESSAGING ---
function renderMsg(user, content, cls, time, type, fname) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    
    let inner = '';
    if (cls === 'partner-message') {
        inner += `<span class="msg-sender">${user}</span>`;
    }
    
    if (type === "text") {
        inner += `<span>${content}</span>`;
    } else if (type === "audio") {
        inner += `<audio controls src="${content}"></audio>`;
    } else if (type === "file") {
        inner += `<a href="${content}" download="${fname}" style="color:var(--accent); font-weight:bold; text-decoration:none;">📄 ${fname}</a>`;
    }
    
    div.innerHTML = `${inner}<div class="timestamp">${time}</div>`;
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

// --- SEND CONTROLS ---
document.getElementById("sendBtn").onclick = () => {
    const i = document.getElementById("messageInput");
    if(i.value.trim()) { 
        send(i.value.trim()); 
        i.value = ""; 
        document.getElementById('recordBtn').style.display = 'block';
        document.getElementById('sendBtn').style.display = 'none';
    }
};

document.getElementById("messageInput").onkeydown = (e) => { 
    if(e.key === "Enter") document.getElementById("sendBtn").click(); 
};

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
        } catch (err) { alert("Microphone permission denied."); }
    }
};