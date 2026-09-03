// Entry point. Each module wires up its own DOM listeners at import time
// (safe here since module scripts execute after the document is parsed).
import './ui.js';
import './notifications.js';
import './contacts.js';
import './chat.js';
import './webrtc.js';
import './auth.js';