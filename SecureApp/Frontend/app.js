// Add to the top of app.js
let contacts = new Set();

function openSettings() { document.getElementById('settings-overlay').style.display = 'flex'; }
function closeSettings() { document.getElementById('settings-overlay').style.display = 'none'; }

// Theme Toggle Logic
document.getElementById('theme-toggle').onchange = (e) => {
    if (!e.target.checked) {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
};

// Update ws.onmessage to track contacts
ws.onmessage = async (e) => {
    const dec = await decrypt(e.data, secretKey);
    if (!dec) return;
    const data = JSON.parse(dec);
    
    if (data.isSignal) {
        handleSignal(data);
    } else {
        // Track the user in our contact list
        if (data.user && data.user !== "You") {
            addContact(data.user);
        }
        renderMsg(data.user, data.content, "partner-message", data.time, data.type, data.fname);
    }
};

function addContact(username) {
    if (contacts.has(username)) return;
    contacts.add(username);
    const list = document.getElementById('contact-list');
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = `
        <div class="avatar-circle">${username[0].toUpperCase()}</div>
        <span>${username}</span>
    `;
    item.onclick = () => {
        document.getElementById('active-chat-user').innerText = username;
        // Visual indicator for active chat
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
    };
    list.appendChild(item);
}
