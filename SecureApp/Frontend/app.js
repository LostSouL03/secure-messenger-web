let ws, myUsername, secretKey;
let mediaRecorder, audioChunks = [];
let contacts = new Set(JSON.parse(localStorage.getItem('chat_contacts') || '[]'));

// Login Logic
document.getElementById('loginBtn').onclick = () => {
    myUsername = document.getElementById("usernameInput").value;
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
        document.getElementById('callBtn').style.display = 'block'; // Show call button
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };
    list.appendChild(item);
}

function renderMsg(user, content, cls, time, type, fname) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    let inner = `<strong>${user}</strong><br>`;
    
    if (type === "text") inner += content;
    else if (type === "audio") {
        // Added controls and styling for length/playability
        inner += `<audio controls src="${content}" style="width:220px; margin-top:5px;"></audio>`;
    }
    
    div.innerHTML = `${inner}<div class="timestamp">${time}</div>`;
    document.getElementById("messages").appendChild(div);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}

async function send(content, type="text", fname="") {
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const payload = {user:myUsername, content, type, time, fname};
    const enc = await encrypt(JSON.stringify(payload), secretKey);
    ws.send(enc);
    renderMsg("You", content, "my-message", time, type, fname);
}

// Fixed Voice Recording to prevent double-sending
document.getElementById("recordBtn").onclick = async function() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        this.style.color = "#8696a0";
    } else {
        const stream = await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
            const reader = new FileReader();
            reader.onloadend = () => send(reader.result, "audio");
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(track => track.stop()); // Stop mic hardware
        };
        mediaRecorder.start();
        this.style.color = "red";
    }
};

document.getElementById("sendBtn").onclick = () => {
    const input = document.getElementById("messageInput");
    if(input.value) { send(input.value); input.value = ""; }
};
