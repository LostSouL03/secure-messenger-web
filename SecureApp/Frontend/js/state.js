// Central, shared application state.
// Other modules import `state` and mutate its properties directly
// (there's no framework here, so this plays the role of a simple store).

export const state = {
    ws: null,
    myUsername: null,
    secretKey: null,

    contacts: new Set(JSON.parse(localStorage.getItem('chat_contacts') || '[]')),
    chatHistory: JSON.parse(localStorage.getItem('chat_history') || '{}'),
    activeChatUser: null,

    // Add-contact handshake
    pendingContact: null,
    pendingAddTimeout: null,

    // Typing throttle
    lastTypingSentAt: 0,

    // Presence heartbeat (fixes stale "online" status)
    heartbeatTimer: null,
    awaitingPong: new Map(), // username -> true while we're waiting on a pong

    // WebRTC
    pc: null,
    mediaStream: null,
    pendingCandidates: [], // ICE candidates that arrive before `pc` exists
};

export const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function persistContacts() {
    localStorage.setItem('chat_contacts', JSON.stringify([...state.contacts]));
}

export function persistHistory() {
    localStorage.setItem('chat_history', JSON.stringify(state.chatHistory));
}