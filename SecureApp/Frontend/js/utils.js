// Small shared helpers.

export const $ = (id) => document.getElementById(id);

// Escapes text for safe insertion into innerHTML.
// Used anywhere untrusted (remote) content ends up in markup.
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

export function formatTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function makeMessageId() {
    return 'msg_' + Date.now().toString() + Math.random().toString(36).substr(2, 5);
}