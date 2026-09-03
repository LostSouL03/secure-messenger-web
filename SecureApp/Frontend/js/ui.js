import { $ } from './utils.js';

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        $('theme-toggle').checked = true;
    }
});

$('theme-toggle').onchange = e => {
    document.body.classList.toggle('light-mode', e.target.checked);
    localStorage.setItem('theme', e.target.checked ? 'light' : 'dark');
};

// Exposed on window because index.html calls these via inline onclick=""
window.openSettings = () => { $('settings-overlay').style.display = 'flex'; };
window.closeSettings = () => { $('settings-overlay').style.display = 'none'; };
window.logout = () => location.reload();