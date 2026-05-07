let ws, myUsername, secretKey;
let mediaRecorder, audioChunks = [];
let contacts = new Set(JSON.parse(localStorage.getItem('chat_contacts') || '[]'));
let chatHistory = JSON.parse(localStorage.getItem('chat_history') || '{}');
let activeChatUser = null; 
let typingTimeout;

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
    const errorBox = document.getElementById("login-error");
    
    if (errorBox) { errorBox.style.display = "none"; errorBox.innerText = ""; }

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    if (!myUsername || !secretKey) {
        if (errorBox) { errorBox.innerText = "Credentials required."; errorBox.style.display = "block"; }
        return;
    }

    let accounts = JSON.parse(localStorage.getItem('secure_accounts') || '{}');
    if (accounts[myUsername] && accounts[myUsername] !== secretKey) {
        if (errorBox) { errorBox.innerText = "Invalid Secret Key for this username."; errorBox.style.display = "block"; }
        return;
    } else {
        accounts[myUsername] = secretKey;
        localStorage.setItem('secure_accounts', JSON.stringify(accounts));
    }

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
        
        // 1. Handshake logic
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

        // 2. WebRTC Call Signals
        if (data.isSignal && data.target === myUsername) {
            handleSignal(data);
            return;
        }

        // 3. READ RECEIPTS (Incoming)
        if (data.type === 'read' && data.target === myUsername) {
            // Update local history
            if (chatHistory[data.user]) {
                const msg = chatHistory[data.user].find(m => m.id === data.id);
                if (msg) msg.status = 'read';
                localStorage.setItem('chat_history', JSON.stringify(chatHistory));
            }
            // Update UI instantly if we are looking at the chat
            if (activeChatUser === data.user) {
                const statusEl = document.getElementById(`status-${data.id}`);
                if (statusEl) {
                    statusEl.className = 'msg-status tick-read';
                    statusEl.innerText = '✓✓'; // Change to double tick
                }
            }
            return;
        }

        // 4. Chat Messages & Typing
        if (data.user !== myUsername && (!data.target || data.target === myUsername || data.target === "all")) {
            if (data.type === "typing") {
                showTyping(data.user);
            } else {
                addContact(data.user);
                updateStatus(data.user, true);
                
                // Save incoming message
                saveMessage(data.user, { id: data.id, sender: data.user, content: data.content, time: data.time, type: data.type, fname: data.fname });
                
                if (activeChatUser === data.user && !document.hidden) {
                    // You are looking right at the chat, render it and send read receipt
                    renderMsg(data.user, data.content, "partner-message", data.time, data.type, data.fname, data.id, null);
                    sendReadReceipt(data.user, data.id);
                } else {
                    // --- NEW: Trigger Notification & Unread Badge ---
                    notifyUser(data.user, data.type, data.content);
                    
                    const subtitle = document.getElementById(`subtitle-${data.user}`);
                    if (subtitle && !subtitle.querySelector('.typing-indicator')) {
                        subtitle.innerHTML = `<span style="color: var(--accent); font-weight: bold;">New message</span>`;
                    }
                }
                
                hideTyping(data.user);
            }
        }
    };
};

// --- READ RECEIPT SENDER ---
function sendReadReceipt(targetUser, messageId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        encrypt(JSON.stringify({ user: myUsername, type: "read", target: targetUser, id: messageId }), secretKey).then(enc => ws.send(enc));
    }
}

// --- ADD CONTACT ---
let pendingContact = null;
let pendingAddTimeout = null;

function promptAddContact() {
    if (!myUsername) return alert("Please log in first.");
    const newContact = prompt("Enter the exact username to connect with:");
    if (!newContact || newContact.trim() === "" || newContact.trim() === myUsername) return;
    
    pendingContact = newContact.trim();
    encrypt(JSON.stringify({ user: myUsername, type: 'ping', target: pendingContact }), secretKey).then(enc => ws.send(enc));
    
    pendingAddTimeout = setTimeout(() => {
        alert(`User '${pendingContact}' is not online.`);
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

// --- SWITCHING CHATS ---
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
        activeChatUser = u;
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('active-chat-area').style.display = 'flex';
        document.getElementById('active-chat-user').innerText = u;
        document.getElementById('active-chat-avatar').innerText = initial;
        
        const isOnline = item.querySelector('.status-dot').classList.contains('status-online');
        document.getElementById('active-chat-status').innerText = isOnline ? 'Online' : '';
        
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        
        const msgContainer = document.getElementById("messages");
        msgContainer.innerHTML = ""; 
        
        const history = chatHistory[activeChatUser] || [];
        history.forEach(msg => {
            const cls = msg.sender === "You" ? "my-message" : "partner-message";
            renderMsg(msg.sender, msg.content, cls, msg.time, msg.type, msg.fname, msg.id, msg.status);
            
            // If we are loading an unread message from our partner, send them a read receipt now
            if (msg.sender !== "You" && !msg.readReceiptSent) {
                sendReadReceipt(activeChatUser, msg.id);
                msg.readReceiptSent = true; 
            }
        });
        localStorage.setItem('chat_history', JSON.stringify(chatHistory));
    };
    list.appendChild(item);
}

// --- MESSAGE HISTORY SAVER ---
function saveMessage(contact, msgObj) {
    if (!chatHistory[contact]) chatHistory[contact] = [];
    chatHistory[contact].push(msgObj);
    localStorage.setItem('chat_history', JSON.stringify(chatHistory));
}

// --- STATUS & TYPING ---
function updateStatus(user, isOnline) {
    const el = document.getElementById(`contact-${user}`);
    if (el) {
        el.querySelector('.status-dot').classList.toggle('status-online', isOnline);
        if (activeChatUser === user) document.getElementById('active-chat-status').innerText = isOnline ? 'Online' : '';
    }
}

function sendTypingStatus() {
    if (ws && ws.readyState === WebSocket.OPEN && activeChatUser) {
        encrypt(JSON.stringify({ user: myUsername, type: "typing", target: activeChatUser }), secretKey).then(enc => ws.send(enc));
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

// --- RENDER & SEND MESSAGES ---
function renderMsg(user, content, cls, time, type, fname, msgId, status) {
    const div = document.createElement("div");
    div.className = `message ${cls}`;
    let inner = cls === 'partner-message' ? `<span class="msg-sender">${user}</span>` : '';
    
    if (type === "text") {
        inner += `<span>${content}</span>`;
    } else if (type === "audio") {
        inner += `<audio controls src="${content}"></audio>`;
    } else if (type === "file") {
        if (content.startsWith('data:image/')) {
            inner += `<img src="${content}" class="chat-image" onclick="window.open('${content}')"><br>`;
        }
        inner += `<a href="${content}" download="${fname}" style="color:var(--accent); font-weight:bold; text-decoration:none;">📄 Download ${fname}</a>`;
    }
    
    // Generate the Tick HTML if it's your message
    let statusHtml = '';
    if (cls === 'my-message') {
        const tickClass = status === 'read' ? 'tick-read' : 'tick-sent';
        const tickText = status === 'read' ? '✓✓' : '✓';
        statusHtml = `<span class="msg-status ${tickClass}" id="status-${msgId}">${tickText}</span>`;
    }
    
    div.innerHTML = `${inner}<div class="msg-footer"><span class="timestamp">${time}</span>${statusHtml}</div>`;
    const m = document.getElementById("messages");
    m.appendChild(div);
    m.scrollTop = m.scrollHeight;
}

async function send(content, type="text", fname="") {
    if (!activeChatUser) return alert("Please select a chat first!");
    
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const msgId = "msg_" + Date.now().toString() + Math.random().toString(36).substr(2, 5); // Generate unique ID
    
    const payload = JSON.stringify({user:myUsername, content, type, time, fname, target: activeChatUser, id: msgId});
    const enc = await encrypt(payload, secretKey);
    ws.send(enc);
    
    saveMessage(activeChatUser, { id: msgId, sender: "You", content: content, time: time, type: type, fname: fname, status: 'sent' });
    renderMsg("You", content, "my-message", time, type, fname, msgId, 'sent');
}

// --- CALL BUTTON (WEBRTC) ---
document.getElementById('callBtn').onclick = async () => {
    if (!activeChatUser) return alert("Select a contact to call.");
    document.getElementById("video-container").style.display = "flex";
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        document.getElementById("localVideo").srcObject = mediaStream;
        pc = new RTCPeerConnection(config);
        mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));
        pc.onicecandidate = e => e.candidate && sendSignal({type:"candidate", candidate:e.candidate, target: activeChatUser});
        pc.ontrack = e => document.getElementById("remoteVideo").srcObject = e.streams[0];
        const off = await pc.createOffer();
        await pc.setLocalDescription(off);
        sendSignal({type:"offer", offer:off, target: activeChatUser});
    } catch (e) { alert("Camera/Mic access denied!"); document.getElementById("video-container").style.display = "none"; }
};

async function handleSignal(d) {
    if (d.type === "offer") {
        if (!confirm(`Incoming video call from ${d.user}. Answer?`)) return sendSignal({ type: "hangup", target: d.user });
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
        endCall(false); alert(`${d.user} ended the call.`);
    }
}

function sendSignal(s) {
    s.isSignal = true; s.user = myUsername;
    encrypt(JSON.stringify(s), secretKey).then(enc => ws.send(enc));
}

document.getElementById('hangupBtn').onclick = () => endCall(true);
function endCall(notify=true) {
    if (notify && activeChatUser) sendSignal({type:"hangup", target: activeChatUser});
    if (pc) pc.close();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    document.getElementById("video-container").style.display = "none";
}

// --- STANDARD CONTROLS ---
document.getElementById("sendBtn").onclick = () => {
    const i = document.getElementById("messageInput");
    if(i.value.trim()) { 
        send(i.value.trim()); 
        i.value = ""; 
        document.getElementById('recordBtn').style.display = 'block'; 
        document.getElementById('sendBtn').style.display = 'none';
    }
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

// --- DELETE CHAT LOGIC ---
document.getElementById('deleteChatBtn').onclick = () => {
    if (!activeChatUser) return;
    
    // Ask for confirmation before wiping data
    if (confirm(`Are you sure you want to delete your chat with ${activeChatUser}? This will erase all message history and remove them from your contacts.`)) {
        
        // 1. Remove from contacts list & save
        contacts.delete(activeChatUser);
        localStorage.setItem('chat_contacts', JSON.stringify([...contacts]));
        
        // 2. Remove from local chat history & save
        delete chatHistory[activeChatUser];
        localStorage.setItem('chat_history', JSON.stringify(chatHistory));
        
        // 3. Remove their name from the sidebar UI
        const contactEl = document.getElementById(`contact-${activeChatUser}`);
        if (contactEl) contactEl.remove();
        
        // 4. Clear the active chat view and return to the empty state
        activeChatUser = null;
        document.getElementById('active-chat-area').style.display = 'none';
        document.getElementById('empty-state').style.display = 'flex';
    }
};

// --- BROWSER NOTIFICATIONS ---
function notifyUser(sender, messageType, content) {
    if ("Notification" in window && Notification.permission === "granted") {
        // Only notify if the tab is hidden OR you are looking at a different chat
        if (document.hidden || activeChatUser !== sender) {
            
            // Format the text based on what was sent
            let previewText = content;
            if (messageType === "audio") previewText = "🎤 Sent a voice message";
            if (messageType === "file" && content.startsWith("data:image/")) previewText = "📷 Sent an image";
            else if (messageType === "file") previewText = "📎 Sent a file";

            const notification = new Notification(`New message from ${sender}`, {
                body: previewText,
                // Uses a simple speech bubble emoji as the icon
                icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💬</text></svg>'
            });

            // When you click the desktop notification, focus the window and open the chat
            notification.onclick = function() {
                window.focus();
                const contactEl = document.getElementById(`contact-${sender}`);
                if (contactEl) contactEl.click();
                this.close();
            };
        }
    }
}