import { state, persistHistory } from './state.js';
import { $ } from './utils.js';
import { formatTime, makeMessageId } from './utils.js';
import { sendEncrypted } from './network.js';
import { notifyUser } from './notifications.js';
import { isContactOnline } from './contacts.js';

const TYPING_THROTTLE_MS = 2000;
const TYPING_EXPIRE_MS = 3000;

// --- OPEN A CONVERSATION (called from contacts.js when a contact is clicked) ---

export function openChat(u, item, initial) {
    state.activeChatUser = u;

    const subtitle = $(`subtitle-${u}`);
    if (subtitle && subtitle.innerText === 'New message') subtitle.innerHTML = '';

    $('empty-state').style.display = 'none';
    $('active-chat-area').style.display = 'flex';
    $('active-chat-user').innerText = u;
    $('active-chat-avatar').innerText = initial;

    const isOnline = item.querySelector('.status-dot').classList.contains('status-online');
    $('active-chat-status').innerText = isOnline ? 'Online' : '';
    $('active-chat-status').style.color = '';
    $('active-chat-status').style.fontStyle = 'normal';

    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');

    const msgContainer = $('messages');
    msgContainer.innerHTML = '';

    const history = state.chatHistory[state.activeChatUser] || [];
    history.forEach(msg => {
        const cls = msg.sender === 'You' ? 'my-message' : 'partner-message';
        renderMsg(msg.sender, msg.content, cls, msg.time, msg.type, msg.fname, msg.id, msg.status);

        if (msg.sender !== 'You' && !msg.readReceiptSent) {
            sendReadReceipt(state.activeChatUser, msg.id);
            msg.readReceiptSent = true;
        }
    });
    persistHistory();
}

// --- SAVE ---

function saveMessage(contact, msgObj) {
    if (!state.chatHistory[contact]) state.chatHistory[contact] = [];
    state.chatHistory[contact].push(msgObj);
    persistHistory();
}

// --- READ RECEIPTS ---

export function sendReadReceipt(targetUser, messageId) {
    sendEncrypted({ user: state.myUsername, type: 'read', target: targetUser, id: messageId });
}

export function handleReadReceipt(data) {
    const history = state.chatHistory[data.user];
    if (history) {
        const msg = history.find(m => m.id === data.id);
        if (msg) msg.status = 'read';
        persistHistory();
    }
    if (state.activeChatUser === data.user) {
        const statusEl = $(`status-${data.id}`);
        if (statusEl) {
            statusEl.className = 'msg-status tick-read';
            statusEl.innerText = '✓✓';
        }
    }
}

// --- TYPING ---

export function sendTypingStatus() {
    const now = Date.now();
    if (now - state.lastTypingSentAt < TYPING_THROTTLE_MS) return; // fix: was firing on every keystroke
    state.lastTypingSentAt = now;
    if (state.activeChatUser) {
        sendEncrypted({ user: state.myUsername, type: 'typing', target: state.activeChatUser });
    }
}

export function handleTyping(user) {
    showTyping(user);
}

function showTyping(user) {
    const subtitle = $(`subtitle-${user}`);
    if (subtitle) {
        subtitle.innerHTML = '<span class="typing-indicator" style="color: var(--accent); font-style: italic;">typing...</span>';
        clearTimeout(subtitle.typingTimer);
        subtitle.typingTimer = setTimeout(() => hideTyping(user), TYPING_EXPIRE_MS);
    }
    if (state.activeChatUser === user) {
        const chatStatus = $('active-chat-status');
        chatStatus.innerText = 'typing...';
        chatStatus.style.color = 'var(--accent)';
        chatStatus.style.fontStyle = 'italic';
    }
}

function hideTyping(user) {
    const subtitle = $(`subtitle-${user}`);
    if (subtitle) subtitle.innerHTML = '';

    if (state.activeChatUser === user) {
        const chatStatus = $('active-chat-status');
        const online = isContactOnline(user);
        chatStatus.innerText = online ? 'Online' : '';
        chatStatus.style.color = '';
        chatStatus.style.fontStyle = 'normal';
    }
}

// --- RENDER (built via DOM APIs — fixes stored/reflected XSS from the old
// innerHTML string-concat version, which injected message text, filenames,
// and even an inline onclick handler built from unescaped content) ---

export function renderMsg(user, content, cls, time, type, fname, msgId, status) {
    const div = document.createElement('div');
    div.className = `message ${cls}`;

    if (cls === 'partner-message') {
        const senderEl = document.createElement('span');
        senderEl.className = 'msg-sender';
        senderEl.textContent = user;
        div.appendChild(senderEl);
    }

    if (type === 'text') {
        const span = document.createElement('span');
        span.textContent = content;
        div.appendChild(span);
    } else if (type === 'audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = content;
        div.appendChild(audio);
    } else if (type === 'file') {
        if (content.startsWith('data:image/')) {
            const img = document.createElement('img');
            img.src = content;
            img.className = 'chat-image';
            img.addEventListener('click', () => window.open(content));
            div.appendChild(img);
            div.appendChild(document.createElement('br'));
        }
        const link = document.createElement('a');
        link.href = content;
        link.download = fname;
        link.style.color = 'var(--accent)';
        link.style.fontWeight = 'bold';
        link.style.textDecoration = 'none';
        link.textContent = `📄 Download ${fname}`;
        div.appendChild(link);
    }

    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = time;
    footer.appendChild(timestamp);

    if (cls === 'my-message') {
        const tickClass = status === 'read' ? 'tick-read' : 'tick-sent';
        const tickText = status === 'read' ? '✓✓' : '✓';
        const statusEl = document.createElement('span');
        statusEl.className = `msg-status ${tickClass}`;
        statusEl.id = `status-${msgId}`;
        statusEl.textContent = tickText;
        footer.appendChild(statusEl);
    }

    div.appendChild(footer);
    const m = $('messages');
    m.appendChild(div);
    m.scrollTop = m.scrollHeight;
}

// --- SEND ---

export async function send(content, type = 'text', fname = '') {
    if (!state.activeChatUser) return alert('Please select a chat first!');

    const time = formatTime();
    const msgId = makeMessageId();

    await sendEncrypted({ user: state.myUsername, content, type, time, fname, target: state.activeChatUser, id: msgId });

    saveMessage(state.activeChatUser, { id: msgId, sender: 'You', content, time, type, fname, status: 'sent' });
    renderMsg('You', content, 'my-message', time, type, fname, msgId, 'sent');

    // The server has no persistence — if the recipient isn't connected right
    // now, this message won't be queued for them, just dropped after relay.
    if (!isContactOnline(state.activeChatUser)) {
        const chatStatus = $('active-chat-status');
        if (state.activeChatUser && chatStatus) {
            const prevText = chatStatus.innerText;
            chatStatus.innerText = `${state.activeChatUser} is offline — message may not be delivered`;
            chatStatus.style.color = '#f15c6d';
            setTimeout(() => {
                if (chatStatus.innerText.includes('offline — message')) {
                    chatStatus.innerText = prevText;
                    chatStatus.style.color = '';
                }
            }, 4000);
        }
    }
}

// --- INCOMING MESSAGE (called from network.js) ---

export function handleIncomingMessage(data) {
    saveMessage(data.user, { id: data.id, sender: data.user, content: data.content, time: data.time, type: data.type, fname: data.fname });

    if (state.activeChatUser === data.user && !document.hidden) {
        renderMsg(data.user, data.content, 'partner-message', data.time, data.type, data.fname, data.id, null);
        sendReadReceipt(data.user, data.id);
    } else {
        notifyUser(data.user, data.type, data.content);
        const subtitle = $(`subtitle-${data.user}`);
        if (subtitle && !subtitle.querySelector('.typing-indicator')) {
            subtitle.innerHTML = `<span style="color: var(--accent); font-weight: bold;">New message</span>`;
        }
    }
    hideTyping(data.user);
}

// --- INPUT WIRING ---

$('messageInput').addEventListener('input', function () {
    const mic = $('recordBtn');
    const snd = $('sendBtn');
    if (this.value.trim().length > 0) {
        mic.style.display = 'none';
        snd.style.display = 'block';
        sendTypingStatus();
    } else {
        mic.style.display = 'block';
        snd.style.display = 'none';
    }
});

$('sendBtn').onclick = () => {
    const i = $('messageInput');
    if (i.value.trim()) {
        send(i.value.trim());
        i.value = '';
        $('recordBtn').style.display = 'block';
        $('sendBtn').style.display = 'none';
    }
};
$('messageInput').onkeydown = (e) => { if (e.key === 'Enter') $('sendBtn').click(); };

$('attachBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onloadend = () => send(r.result, 'file', f.name);
    r.readAsDataURL(f);
};

// --- VOICE RECORDING ---

let mediaRecorder, audioChunks = [];

$('recordBtn').onclick = async function () {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        this.classList.remove('recording-active');
    } else {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(s);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const b = new Blob(audioChunks, { type: 'audio/webm' });
                const r = new FileReader();
                r.onloadend = () => send(r.result, 'audio');
                r.readAsDataURL(b);
                s.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            this.classList.add('recording-active');
        } catch (err) {
            alert('Mic denied.');
        }
    }
};