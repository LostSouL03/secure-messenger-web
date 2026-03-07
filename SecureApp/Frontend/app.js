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

function openSettings() { document.getElementById('settings-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }

document.getElementById('theme-toggle').onchange = (e) => {
    const mode = e.target.checked ? 'light' : 'dark';
    document.body.classList.toggle('light-mode', e.target.checked);
    localStorage.setItem('theme', mode);
};

// --- LOGOUT ---
function logout() {
    if (ws) ws.close();
    document.getElementById("main-container").style.display = "none";
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("settings-overlay").style.display = "none";
    myUsername = ""; secretKey = "";
    document.getElementById("usernameInput").value = "";
    document.getElementById("keyInput").value = "";
    document.getElementById("messages").innerHTML = "";
    document.getElementById("active-chat-user").innerText = "";
    document.getElementById("callBtn").style.display = "none";
}

// --- SEARCH ---
document.getElementById('contactSearch').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.contact-item').forEach(item => {
        item.style.display = item.innerText.toLowerCase().includes(term) ? 'block' : 'none';
    });
};

// --- LOGIN ---
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value.trim();
    secretKey = document.getElementById("keyInput").value;
    if (!myUsername || !secretKey) return alert("Username and Key required");

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
    item.innerHTML = `<span>${u}</span>`;
    item.onclick = () => {
        document.getElementById('active-chat-user').innerText = u;
        document.getElementById('callBtn').style.display = 'block';
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };
    list.appendChild(item);
}

// --- MESSAGING ---
function renderMsg(user, content, cls, time, type, fname) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    let inner = `<strong>${user}</strong><br>`;
    
    if (type === "text") inner += content;
    else if (type === "audio") inner += `<audio controls src="${content}"></audio>`;
    else if (type === "file") inner += `<a href="${content}" download="${fname}" style="color:var(--accent); font-weight:bold; text-decoration:none;">📄 ${fname}</a>`;
    
    div.innerHTML = `${inner}<div class="timestamp">${time}</div>`;
    const msgBox = document.getElementById("messages");
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
}

async function send(content, type="text", fname="") {
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const enc = await encrypt(JSON.stringify({user:myUsername, content, type, time, fname}), secretKey);
    ws.send(enc);
    renderMsg("You", content, "my-message", time, type, fname);
}

// --- FILE & VOICE ---
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
        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(s);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
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

document.getElementById("sendBtn").onclick = () => {
    const i = document.getElementById("messageInput");
    if(i.value.trim()) { send(i.value.trim()); i.value = ""; }
};
document.getElementById("messageInput").onkeydown = (e) => { if(e.key === "Enter") document.getElementById("sendBtn").click(); };
