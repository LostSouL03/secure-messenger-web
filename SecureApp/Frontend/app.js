// Ensure this script runs only after everything is loaded
document.addEventListener('DOMContentLoaded', () => {
    
    const loginBtn = document.getElementById('loginBtn');
    
    loginBtn.onclick = () => {
        myUsername = document.getElementById("usernameInput").value.trim();
        secretKey = document.getElementById("keyInput").value;

        if (!myUsername || !secretKey) {
            alert("Please enter both a Username and Auth Key.");
            return;
        }

        // Initialize WebSocket
        const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
        ws = new WebSocket(`${protocol}${window.location.host}/ws`);
        
        ws.onopen = () => {
            console.log("Connected to secure relay.");
            document.getElementById("login-screen").style.display = "none";
            document.getElementById("main-container").style.display = "flex";
            // Load persistent contacts
            contacts.forEach(u => displayContact(u));
        };

        ws.onerror = (err) => {
            alert("Connection failed. Is the backend running?");
            console.error(err);
        };

        // ... include the rest of your ws.onmessage logic here ...
    };

    // Allow pressing "Enter" key to login
    document.getElementById("keyInput").onkeydown = (e) => {
        if (e.key === "Enter") loginBtn.click();
    };
});
