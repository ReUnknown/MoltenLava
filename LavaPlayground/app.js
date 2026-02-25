const STORAGE_KEY = 'LavaPlayground_v1';
let store = { chats: [], globalTokens: 0, globalCost: 0 };
let currentChatId = null;
let currentChat = null;

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    getStore();

    // Markdown Setup
    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-',
        breaks: true,
        gfm: true
    });

    if (!localStorage.getItem('MoltenLava_API_Key')) {
        AppModal.requestGlobalApiKey();
    }

    if (store.chats.length === 0) {
        createNewChat();
    } else {
        // Load most recent or first
        loadChat(store.chats[0].id);
    }

    renderSidebar();
    updateGlobalStats();
});

function getStore() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) store = Object.assign(store, JSON.parse(data));
    } catch (e) { console.error(e); }
}

function saveStore() {
    if (currentChat) {
        currentChat.updated = Date.now();
        const index = store.chats.findIndex(c => c.id === currentChatId);
        if (index !== -1) store.chats[index] = currentChat;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    updateGlobalStats();
}

// ━━━ KEY MANAGEMENT ━━━
function openKeySettings() {
    AppModal.requestGlobalApiKey();
}
// ━━━ CHAT MANAGEMENT ━━━
function createNewChat() {
    const newChat = {
        id: 'pg_' + Date.now(),
        created: Date.now(),
        updated: Date.now(),
        messages: [],
        config: {
            model: 'openai/gpt-oss-120b',
            system: 'You are a highly capable AI assistant operating within a professional playground UI.',
            temperature: 0.7,
            topP: 1.0
        }
    };
    store.chats.unshift(newChat);
    saveStore();
    loadChat(newChat.id);
    renderSidebar();
}

function loadChat(id) {
    currentChatId = id;
    currentChat = store.chats.find(c => c.id === id);
    if (!currentChat) return;

    // Load Config into UI
    const cfg = currentChat.config;

    // Model Dropdown
    const modelSel = document.getElementById('modelSelect');
    const customInp = document.getElementById('customModelId');
    const opts = Array.from(modelSel.options).map(o => o.value);

    if (opts.includes(cfg.model)) {
        modelSel.value = cfg.model;
        customInp.classList.add('hidden');
    } else {
        modelSel.value = 'custom';
        customInp.value = cfg.model;
        customInp.classList.remove('hidden');
    }

    // Sliders & Textareas
    document.getElementById('systemPrompt').value = cfg.system || '';

    document.getElementById('tempSlider').value = cfg.temperature !== undefined ? cfg.temperature : 0.7;
    document.getElementById('tempVal').innerText = cfg.temperature !== undefined ? cfg.temperature : 0.7;

    document.getElementById('topPSlider').value = cfg.topP !== undefined ? cfg.topP : 1.0;
    document.getElementById('topPVal').innerText = cfg.topP !== undefined ? cfg.topP : 1.0;

    renderSidebar();
    renderMessages();
}

function saveConfig() {
    if (!currentChat) return;

    const msel = document.getElementById('modelSelect').value;
    currentChat.config.model = msel === 'custom' ? document.getElementById('customModelId').value : msel;

    if (msel === 'custom') document.getElementById('customModelId').classList.remove('hidden');
    else document.getElementById('customModelId').classList.add('hidden');

    currentChat.config.system = document.getElementById('systemPrompt').value;
    currentChat.config.temperature = parseFloat(document.getElementById('tempSlider').value);
    currentChat.config.topP = parseFloat(document.getElementById('topPSlider').value);

    saveStore();
}

function clearCurrentChat() {
    if (!currentChat) return;
    if (confirm('Clear all messages in this playground session?')) {
        currentChat.messages = [];
        saveStore();
        renderMessages();
    }
}

// ━━━ UI RENDERING ━━━
function renderSidebar() {
    const list = document.getElementById('sessionList');
    list.innerHTML = '';

    store.chats.sort((a, b) => b.updated - a.updated).forEach(c => {
        const el = document.createElement('div');
        el.className = 'session-item' + (c.id === currentChatId ? ' active' : '');

        // Provide snippet
        let snippet = c.title || 'New Playground';
        const fp = c.messages.find(m => m.role === 'user');
        if (!c.title && fp) snippet = fp.text;

        el.innerHTML = `
            <div class="session-title">${escapeHtml(snippet)}</div>
            <div class="session-meta">${new Date(c.updated).toLocaleDateString()}</div>
        `;
        el.onclick = () => loadChat(c.id);
        el.oncontextmenu = (e) => {
            e.preventDefault();
            showPlaygroundContext(e.pageX, e.pageY, c.id);
        };
        list.appendChild(el);
    });
}

function showPlaygroundContext(x, y, id) {
    let menu = document.getElementById('pgContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'pgContextMenu';
        menu.className = 'pg-context-menu';
        document.body.appendChild(menu);

        document.addEventListener('click', () => {
            if (menu) menu.style.display = 'none';
        });
    }

    menu.innerHTML = `
        <div class="pg-ctx-item" onclick="renamePgSession('${id}')">Rename Session</div>
        <div class="pg-ctx-item" onclick="deletePgSession('${id}')" style="color:#ef4444;">Delete Session</div>
    `;

    menu.style.display = 'flex';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function renamePgSession(id) {
    const chat = store.chats.find(c => c.id === id);
    if (!chat) return;
    AppModal.prompt('Enter new session title:', chat.title || '', 'Rename Session').then(val => {
        if (val) {
            chat.title = val;
            saveStore();
            renderSidebar();
        }
    });
}

function deletePgSession(id) {
    AppModal.confirm('Permanently delete this playground session?').then(yes => {
        if (yes) {
            store.chats = store.chats.filter(c => c.id !== id);
            saveStore();
            if (store.chats.length === 0) createNewChat();
            else if (currentChatId === id) loadChat(store.chats[0].id);
            else renderSidebar();
        }
    });
}

function updateGlobalStats() {
    document.getElementById('globalTokens').textContent = store.globalTokens.toLocaleString();
}

function renderMessages() {
    const vp = document.getElementById('chatViewport');
    vp.innerHTML = '';

    if (!currentChat || currentChat.messages.length === 0) {
        vp.innerHTML = `<div style="text-align:center; color:var(--muted); margin-top: 4rem;">System Ready. Enter a prompt below to evaluate model.</div>`;
        return;
    }

    currentChat.messages.forEach(msg => {
        const wrap = document.createElement('div');
        wrap.className = 'msg-wrap ' + msg.role;

        let content = '';
        if (msg.role === 'user') {
            content = `<div class="msg-bubble">${escapeHtml(msg.text)}</div>`;
        } else {
            try {
                const parsed = DOMPurify.sanitize(marked.parse(msg.text || ''));
                content = `<div class="msg-bubble ai-markdown">${parsed}</div>`;
            } catch (e) {
                content = `<div class="msg-bubble">${escapeHtml(msg.text)}</div>`;
            }
        }

        let metaData = '';
        if (msg.meta) {
            metaData = `<div class="msg-meta">
                <span>Tokens: ${msg.meta.tokens}</span>
                <span>Time: ${msg.meta.time}s</span>
                <span>TPS: ${msg.meta.tps}</span>
            </div>`;
        }

        wrap.innerHTML = content + metaData;
        vp.appendChild(wrap);
    });

    vp.scrollTop = vp.scrollHeight;
}

function escapeHtml(unsafe) {
    return (unsafe || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// ━━━ OPENROUTER PIPELINE ━━━
async function sendMessage() {
    const input = document.getElementById('promptInput');
    const text = input.value.trim();
    if (!text || !currentChat) return;

    // Estimate generic tokens (very rough: 1 token = 4 chars)
    document.getElementById('liveTokenCount').innerText = `Tokens: ~${Math.ceil(text.length / 4)}`;

    currentChat.messages.push({ role: 'user', text: text });
    saveStore();

    input.value = '';
    renderMessages();

    document.getElementById('btnSend').disabled = true;

    // Loader
    const vp = document.getElementById('chatViewport');
    const loadEl = document.createElement('div');
    loadEl.className = 'msg-wrap assistant loading';
    loadEl.innerHTML = `<div class="msg-bubble">Computing parameters...</div>`;
    vp.appendChild(loadEl);
    vp.scrollTop = vp.scrollHeight;

    await fetchPlaygroundAPI();

    document.getElementById('btnSend').disabled = false;
    input.focus();
}

async function fetchPlaygroundAPI() {
    const cfg = currentChat.config;

    let payloadMessages = [];
    if (cfg.system) {
        payloadMessages.push({ role: 'system', content: cfg.system });
    }

    // Append context
    currentChat.messages.forEach(m => {
        if (m.role === 'user' || m.role === 'assistant') {
            payloadMessages.push({ role: m.role, content: m.text });
        }
    });

    const startTime = performance.now();

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('MoltenLava_API_Key')}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://moltenlava.app',
                'X-Title': 'LavaPlayground'
            },
            body: JSON.stringify({
                model: cfg.model,
                temperature: cfg.temperature,
                top_p: cfg.topP,
                messages: payloadMessages
            })
        });

        const data = await response.json();
        const endTime = performance.now();
        const timeSecs = ((endTime - startTime) / 1000).toFixed(2);

        if (response.ok && data.choices && data.choices.length > 0) {
            const aiText = data.choices[0].message.content;

            const totalTokens = data.usage ? data.usage.total_tokens : 0;
            const tps = totalTokens > 0 ? (data.usage.completion_tokens / timeSecs).toFixed(1) : 0;

            currentChat.messages.push({
                role: 'assistant',
                text: aiText,
                meta: {
                    tokens: totalTokens || '?',
                    time: timeSecs,
                    tps: totalTokens > 0 ? tps : '?'
                }
            });

            saveStore();
            renderSidebar();
            renderMessages();

        } else {
            currentChat.messages.push({
                role: 'assistant',
                text: `**API Error:** \n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
                meta: { tokens: 0, time: timeSecs, tps: 0 }
            });
        }

    } catch (err) {
        currentChat.messages.push({
            role: 'assistant',
            text: `**Network Error:** ${err.message}`,
            meta: { tokens: 0, time: 0, tps: 0 }
        });
    }

    saveStore();
    renderSidebar(); // Update title snippets
    renderMessages();
}
