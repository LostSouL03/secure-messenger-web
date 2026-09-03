import { state } from './state.js';
import { $ } from './utils.js';
import { connect, sendEncrypted } from './network.js';
import { renderExistingContacts, announcePresence, startHeartbeat } from './contacts.js';

$('loginBtn').onclick = () => {
    state.myUsername = $('usernameInput').value.trim();
    state.secretKey = $('keyInput').value;
    const errorBox = $('login-error');

    if (errorBox) { errorBox.style.display = 'none'; errorBox.innerText = ''; }

    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

    if (!state.myUsername || !state.secretKey) {
        if (errorBox) { errorBox.innerText = 'Credentials required.'; errorBox.style.display = 'block'; }
        return;
    }

    let accounts = JSON.parse(localStorage.getItem('secure_accounts') || '{}');
    if (accounts[state.myUsername] && accounts[state.myUsername] !== state.secretKey) {
        if (errorBox) { errorBox.innerText = 'Invalid Secret Key for this username.'; errorBox.style.display = 'block'; }
        return;
    }
    accounts[state.myUsername] = state.secretKey;
    localStorage.setItem('secure_accounts', JSON.stringify(accounts));

    connect(() => {
        $('login-screen').style.display = 'none';
        $('main-container').style.display = 'flex';
        document.querySelector('.my-avatar').innerText = state.myUsername.charAt(0).toUpperCase();
        renderExistingContacts();

        // Fix: previously contacts only turned "online" after a ping/pong
        // round-trip. Announcing presence on login lets anyone who already
        // has us as a contact update immediately.
        announcePresence('online');
        startHeartbeat();
    });
};

// Best-effort: let contacts know we're gone. Not guaranteed (network drop,
// crash, etc. can't be caught), but covers the common "close tab" case.
window.addEventListener('pagehide', () => {
    if (state.myUsername && state.ws && state.ws.readyState === WebSocket.OPEN) {
        sendEncrypted({ user: state.myUsername, type: 'offline' });
    }
});