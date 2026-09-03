import { state, RTC_CONFIG } from './state.js';
import { $ } from './utils.js';
import { sendEncrypted } from './network.js';

$('callBtn').onclick = async () => {
    if (!state.activeChatUser) return alert('Select a contact to call.');
    $('video-container').style.display = 'flex';
    try {
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        $('localVideo').srcObject = state.mediaStream;

        state.pc = new RTCPeerConnection(RTC_CONFIG);
        state.mediaStream.getTracks().forEach(t => state.pc.addTrack(t, state.mediaStream));
        state.pc.onicecandidate = e => e.candidate && sendSignal({ type: 'candidate', candidate: e.candidate, target: state.activeChatUser });
        state.pc.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; };

        const off = await state.pc.createOffer();
        await state.pc.setLocalDescription(off);
        sendSignal({ type: 'offer', offer: off, target: state.activeChatUser });
    } catch (e) {
        alert('Camera/Mic access denied!');
        $('video-container').style.display = 'none';
    }
};

export async function handleSignal(d) {
    if (d.type === 'offer') {
        if (!confirm(`Incoming video call from ${d.user}. Answer?`)) {
            return sendSignal({ type: 'hangup', target: d.user });
        }
        $('video-container').style.display = 'flex';
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        $('localVideo').srcObject = state.mediaStream;

        state.pc = new RTCPeerConnection(RTC_CONFIG);
        state.mediaStream.getTracks().forEach(t => state.pc.addTrack(t, state.mediaStream));
        state.pc.onicecandidate = e => e.candidate && sendSignal({ type: 'candidate', candidate: e.candidate, target: d.user });
        state.pc.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; };

        await state.pc.setRemoteDescription(new RTCSessionDescription(d.offer));

        // Fix: candidates that arrived while the confirm() dialog was open
        // (before `pc` existed) were previously dropped with an error.
        await flushPendingCandidates();

        const ans = await state.pc.createAnswer();
        await state.pc.setLocalDescription(ans);
        sendSignal({ type: 'answer', answer: ans, target: d.user });
    } else if (d.type === 'answer') {
        if (!state.pc) return;
        await state.pc.setRemoteDescription(new RTCSessionDescription(d.answer));
        await flushPendingCandidates();
    } else if (d.type === 'candidate') {
        if (!state.pc || !state.pc.remoteDescription) {
            // pc not ready yet (still waiting on confirm(), or remote description
            // not set) — queue it instead of throwing.
            state.pendingCandidates.push(d.candidate);
            return;
        }
        await state.pc.addIceCandidate(new RTCIceCandidate(d.candidate));
    } else if (d.type === 'hangup') {
        endCall(false);
        alert(`${d.user} ended the call.`);
    }
}

async function flushPendingCandidates() {
    while (state.pendingCandidates.length) {
        const candidate = state.pendingCandidates.shift();
        try {
            await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            // Best-effort — a stale candidate for a call that's already moved on.
        }
    }
}

function sendSignal(s) {
    s.isSignal = true;
    s.user = state.myUsername;
    sendEncrypted(s);
}

$('hangupBtn').onclick = () => endCall(true);

export function endCall(notify = true) {
    if (notify && state.activeChatUser) sendSignal({ type: 'hangup', target: state.activeChatUser });
    if (state.pc) state.pc.close();
    if (state.mediaStream) state.mediaStream.getTracks().forEach(t => t.stop());

    // Fix: pc/mediaStream were never cleared, so late-arriving signals after
    // a call ended could act on a closed connection.
    state.pc = null;
    state.mediaStream = null;
    state.pendingCandidates = [];

    $('video-container').style.display = 'none';
}