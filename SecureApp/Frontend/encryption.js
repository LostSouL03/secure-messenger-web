async function deriveKey(pw) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
    return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(text, keyStr) {
    const key = await deriveKey(keyStr);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    
    const comb = new Uint8Array(iv.length + enc.byteLength);
    comb.set(iv); 
    comb.set(new Uint8Array(enc), iv.length);
    
    return btoa(String.fromCharCode(...comb));
}

async function decrypt(data, keyStr) {
    try {
        const key = await deriveKey(keyStr);
        const bin = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bin.slice(0, 12) }, key, bin.slice(12));
        return new TextDecoder().decode(dec);
    } catch (e) {
        return null;
    }
}