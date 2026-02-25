const STORAGE_KEY = 'LavaPlayground_v1';
let store = { chats: [], key: '' };

function getStore() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) store = JSON.parse(data);
    } catch (e) { console.error('Error parsing LavaPlayground store', e); }
}

function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ━━━ INIT ━━━
window.addEventListener('DOMContentLoaded', () => {
    getStore();
    if (!store.key) {
        document.getElementById('settingsOverlay').classList.remove('hidden');
    }
    renderGrid();
});

// ━━━ SETTINGS & API KEY ━━━
function openSettings() {
    document.getElementById('apiKeyInput').value = store.key || '';
    document.getElementById('keyStatus').textContent = 'Keys are stored securely in local browser storage.';
    document.getElementById('keyStatus').style.color = '';
    document.getElementById('settingsOverlay').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsOverlay').classList.add('hidden');
}

async function verifyApiKey() {
    const input = document.getElementById('apiKeyInput');
    const status = document.getElementById('keyStatus');
    const key = input.value.trim();
    if (!key) {
        status.textContent = 'Please enter an API key.';
        status.style.color = '#ef4444';
        return;
    }

    status.textContent = 'Verifying with OpenRouter...';
    status.style.color = '#c084fc';
    document.getElementById('btnVerify').disabled = true;

    try {
        // We will do a lightweight fetch to check auth validity
        const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`
            }
        });

        if (resp.ok) {
            status.textContent = 'API Key verified and saved successfully!';
            status.style.color = '#10b981';
            store.key = key;
            saveStore();
            setTimeout(closeSettings, 1000);
        } else {
            status.textContent = 'Invalid API Key. Please check your OpenRouter dashboard.';
            status.style.color = '#ef4444';
        }
    } catch (err) {
        status.textContent = 'Network error verifying key. Check connection.';
        status.style.color = '#ef4444';
    } finally {
        document.getElementById('btnVerify').disabled = false;
    }
}

// ━━━ CHAT GRID INTERFACE ━━━
function renderGrid() {
    const grid = document.getElementById('chatGrid');
    const empty = document.getElementById('emptyState');
    grid.innerHTML = '';

    if (store.chats.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    // Sort by most recently updated
    const sorted = [...store.chats].sort((a, b) => b.updated - a.updated);

    sorted.forEach(chat => {
        const card = document.createElement('div');
        card.className = 'chat-card';
        card.onclick = (e) => {
            if (e.target.closest('.delete-chat')) return;
            window.location.href = `pg_chat.html?id=${chat.id}`;
        };

        const dateStr = new Date(chat.updated).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Find last user prompt
        let snippet = 'New conversation';
        if (chat.messages && chat.messages.length > 0) {
            const lastMsg = chat.messages[chat.messages.length - 1];
            snippet = lastMsg.text || '...';
        }

        const modelUsed = chat.model || 'Unknown Model';

        card.innerHTML = `
            <button class="delete-chat" onclick="deleteChat('${chat.id}')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
            <div class="chat-date">${dateStr}</div>
            <div class="chat-title">${chat.title || 'Untitled Chat'}</div>
            <div class="chat-snippet">${snippet}</div>
            <div class="chat-model">${modelUsed}</div>
        `;
        grid.appendChild(card);
    });
}

function createNewChat() {
    if (!store.key) {
        openSettings();
        return;
    }
    const newId = 'chat_' + Date.now();
    store.chats.push({
        id: newId,
        title: 'New Chat',
        created: Date.now(),
        updated: Date.now(),
        messages: [],
        model: 'openai/gpt-4o-mini', // Default placeholder
        systemId: 'default'
    });
    saveStore();
    window.location.href = `pg_chat.html?id=${newId}`;
}

async function deleteChat(id) {
    if (await AppModal.confirm('Are you sure you want to delete this chat permanentely?')) {
        store.chats = store.chats.filter(c => c.id !== id);
        saveStore();
        renderGrid();
    }
}

async function deleteAllChats() {
    if (await AppModal.confirm('Warning: This will permanently delete ALL chats. Continue?')) {
        store.chats = [];
        saveStore();
        closeSettings();
        renderGrid();
    }
}

function openCompareMode() {
    if (!store.key) {
        openSettings();
        return;
    }
    window.location.href = 'compare.html';
}
