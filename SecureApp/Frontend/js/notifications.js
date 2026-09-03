import { state } from './state.js';
import { $ } from './utils.js';

export function notifyUser(sender, messageType, content) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!(document.hidden || state.activeChatUser !== sender)) return;

    let previewText = content;
    if (messageType === 'audio') previewText = '🎤 Sent a voice message';
    if (messageType === 'file' && content.startsWith('data:image/')) previewText = '📷 Sent an image';
    else if (messageType === 'file') previewText = '📎 Sent a file';

    // Notification.body renders as plain text (not HTML), so no escaping needed here.
    const notification = new Notification(`New message from ${sender}`, {
        body: previewText,
        icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💬</text></svg>'
    });
    notification.onclick = function () {
        window.focus();
        $(`contact-${sender}`)?.click();
        this.close();
    };
}