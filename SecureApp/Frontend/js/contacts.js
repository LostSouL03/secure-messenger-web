import { state, persistContacts } from './state.js';
import { $, escapeHtml } from './utils.js';
import { sendEncrypted } from './network.js';
import { openChat } from './chat.js';

const HEARTBEAT_INTERVAL_MS = 15000;

// --- ADD CONTACT ---

export function promptAddContact() {
    if (!state.myUsername) return alert('Please log in first.');
    const newContact = prompt('Enter the exact username to connect with:');
    if (!newContact || newContact.trim() === '' || newContact.trim() === state.myUsername) return;

    state.pendingContact = newContact.trim();
    sendEncrypted({ user: state.myUsername, type: 'ping', target: state.pendingContact });

    clearTimeout(state.pendingAddTimeout);
    state.pendingAddTimeout = setTimeout(() => {
        alert(`User '${state.pendingContact}' is not online.`);
        state.pendingContact = null;
    }, 3000);
}

function completeAddContact(u) {
    addContact(u);
    state.pendingContact = null;
    $(`contact-${u}`)?.click();
}

export function addContact(u) {
    if (state.contacts.has(u)) return;
    state.contacts.add(u);
    persistContacts();
    displayContact(u);
}

export function renderExistingContacts() {
    state.contacts.forEach(u => displayContact(u));
}

// --- DISPLAY (built via DOM APIs, not innerHTML, so usernames can't inject markup) ---

export function displayContact(u) {
    const list = $('contact-list');
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.id = `contact-${u}`;
    const initial = u.charAt(0).toUpperCase();

    const avatar = document.createElement('div');
    avatar.className = 'contact-avatar';
    avatar.textContent = initial;

    const info = document.createElement('div');
    info.className = 'contact-info';

    const top = document.createElement('div');
    top.className = 'contact-row-top';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'contact-name';
    nameSpan.textContent = u;
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    top.append(nameSpan, dot);

    const bottom = document.createElement('div');
    bottom.className = 'contact-row-bottom';
    bottom.id = `subtitle-${u}`;

    info.append(top, bottom);
    item.append(avatar, info);

    item.onclick = () => openChat(u, item, initial);
    list.appendChild(item);
}

// --- SEARCH ---

$('contactSearch').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.contact-item').forEach(it => {
        const name = it.querySelector('.contact-name').textContent.toLowerCase();
        it.style.display = name.includes(term) ? 'flex' : 'none';
    });
};

// --- DELETE ---

$('deleteChatBtn').onclick = () => {
    if (!state.activeChatUser) return;
    if (!confirm(`Are you sure you want to delete your chat with ${state.activeChatUser}?`)) return;

    stopHeartbeatFor(state.activeChatUser);
    state.contacts.delete(state.activeChatUser);
    persistContacts();
    delete state.chatHistory[state.activeChatUser];
    localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));

    $(`contact-${state.activeChatUser}`)?.remove();
    state.activeChatUser = null;
    $('active-chat-area').style.display = 'none';
    $('empty-state').style.display = 'flex';
};

// --- STATUS ---

export function updateStatus(user, isOnline) {
    const el = $(`contact-${user}`);
    if (!el) return;
    el.querySelector('.status-dot').classList.toggle('status-online', isOnline);
    if (state.activeChatUser === user && $('active-chat-status').innerText !== 'typing...') {
        $('active-chat-status').innerText = isOnline ? 'Online' : '';
    }
}

export function isContactOnline(user) {
    return !!$(`contact-${user}`)?.querySelector('.status-dot')?.classList.contains('status-online');
}

// --- HANDSHAKE HANDLERS (called from network.js) ---

export function handlePing(data) {
    sendEncrypted({ user: state.myUsername, type: 'pong', target: data.user });
}

export function handlePong(data) {
    clearTimeout(state.pendingAddTimeout);
    if (state.pendingContact === data.user) completeAddContact(data.user);
    state.awaitingPong.delete(data.user);
    updateStatus(data.user, true);
}

export function handleOnlineAnnouncement(data) {
    if (data.user === state.myUsername) return;
    if (state.contacts.has(data.user)) updateStatus(data.user, true);
}

export function handleOfflineAnnouncement(data) {
    if (data.user === state.myUsername) return;
    if (state.contacts.has(data.user)) updateStatus(data.user, false);
}

// --- PRESENCE HEARTBEAT ---
// Fixes: contacts staying "Online" forever after they disconnect, since the
// server never announces disconnects. We ping every contact periodically and
// mark them offline if a ping goes two intervals without a pong.

export function announcePresence(type) {
    sendEncrypted({ user: state.myUsername, type });
}

export function startHeartbeat() {
    stopHeartbeat();
    state.heartbeatTimer = setInterval(() => {
        state.contacts.forEach(u => {
            if (state.awaitingPong.get(u)) {
                // No pong since the last ping — they're gone.
                updateStatus(u, false);
            }
            state.awaitingPong.set(u, true);
            sendEncrypted({ user: state.myUsername, type: 'ping', target: u });
        });
    }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat() {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
}

function stopHeartbeatFor(user) {
    state.awaitingPong.delete(user);
}

// Exposed on window because index.html calls this via inline onclick=""
window.promptAddContact = promptAddContact;