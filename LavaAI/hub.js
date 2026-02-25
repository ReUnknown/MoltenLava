const STORAGE_KEY = 'LavaAI_v1';
let store = { chats: [] };

function getStore() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) store = JSON.parse(data);
    } catch (e) { console.error('Error parsing LavaAI store', e); }
}

function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ━━━ INIT ━━━
window.addEventListener('DOMContentLoaded', () => {
    getStore();
    const globalKey = localStorage.getItem('MoltenLava_API_Key');
    if (!globalKey) {
        AppModal.requestGlobalApiKey().then(k => {
            if (k) renderGrid();
        });
    } else {
        renderGrid();
    }
});

// ━━━ SETTINGS & API KEY ━━━
function openSettings() {
    document.getElementById('settingsOverlay').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsOverlay').classList.add('hidden');
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
            window.location.href = `chat.html?id=${chat.id}`;
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
    if (!localStorage.getItem('MoltenLava_API_Key')) {
        AppModal.requestGlobalApiKey();
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
        systemId: 'default',
        plugins: store.defaultPlugins ? JSON.parse(JSON.stringify(store.defaultPlugins)) : {}
    });
    saveStore();
    window.location.href = `chat.html?id=${newId}`;
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
    if (!localStorage.getItem('MoltenLava_API_Key')) {
        AppModal.requestGlobalApiKey();
        return;
    }
    window.location.href = 'compare.html';
}
