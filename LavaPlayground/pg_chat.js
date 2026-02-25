const STORAGE_KEY = 'LavaPlayground_v1';
let store = { chats: [], key: '' };
let currentChatId = new URLSearchParams(window.location.search).get('id');
let currentChat = null;
let devMode = false;

// ━━━ INIT ━━━
window.addEventListener('DOMContentLoaded', () => {
    getStore();
    if (!store.key) {
        alert("No API Key found. Redirecting to Hub.");
        window.location.href = 'index.html';
        return;
    }

    if (!currentChatId) {
        window.location.href = 'index.html';
        return;
    }

    currentChat = store.chats.find(c => c.id === currentChatId);
    if (!currentChat) {
        alert("Chat not found!");
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('chatTitleInput').value = currentChat.title || 'Untitled Chat';

    // Set UI to match chat data
    const presetSelect = document.getElementById('modelPresetSelect');
    const customInput = document.getElementById('customModelInput');

    if (Array.from(presetSelect.options).some(o => o.value === currentChat.model)) {
        presetSelect.value = currentChat.model;
    } else {
        presetSelect.value = 'custom';
        customInput.classList.remove('hidden');
        customInput.value = currentChat.model || '';
    }

    if (currentChat.systemId) {
        document.getElementById('systemPresetSelect').value = currentChat.systemId;
    }

    renderMessages();

    // Markdown setup
    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-',
        breaks: true,
        gfm: true
    });
});

function getStore() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) store = JSON.parse(data);
    } catch (e) { console.error('Error parsing store', e); }
}

function saveStore() {
    if (currentChat) {
        currentChat.updated = Date.now();
        const index = store.chats.findIndex(c => c.id === currentChatId);
        if (index !== -1) store.chats[index] = currentChat;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function saveCurrentChat() {
    if (!currentChat) return;
    currentChat.title = document.getElementById('chatTitleInput').value;

    const preset = document.getElementById('modelPresetSelect').value;
    if (preset === 'custom') {
        currentChat.model = document.getElementById('customModelInput').value;
    } else {
        currentChat.model = preset;
    }

    currentChat.systemId = document.getElementById('systemPresetSelect').value;
    saveStore();
}

function handleModelChange() {
    const preset = document.getElementById('modelPresetSelect').value;
    const customInput = document.getElementById('customModelInput');
    if (preset === 'custom') {
        customInput.classList.remove('hidden');
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
    }
    saveCurrentChat();
}

function handleSystemChange() {
    // Deprecated in Phase 5: Logic moved to Plugin Engine
}

function openPluginModal() {
    // Sync UI with currentChat plugin state
    document.getElementById('pluginMemoryCompress').checked = currentChat.plugins?.memoryCompress || false;
    document.getElementById('pluginPersonality').value = currentChat.plugins?.personality || 'default';
    document.getElementById('pluginFormato').value = currentChat.plugins?.formato || 'none';

    document.getElementById('pluginManagerOverlay').classList.remove('hidden');
}

function closePluginModal() {
    document.getElementById('pluginManagerOverlay').classList.add('hidden');
}

function savePlugins() {
    if (!currentChat.plugins) currentChat.plugins = {};

    currentChat.plugins.memoryCompress = document.getElementById('pluginMemoryCompress').checked;

    const pVal = document.getElementById('pluginPersonality').value;
    if (pVal === 'custom') {
        // Trigger the old Custom System popup for now
        document.getElementById('customSystemEditorOverlay').classList.remove('hidden');
        closePluginModal();
        return;
    }

    currentChat.plugins.personality = pVal;
    currentChat.plugins.formato = document.getElementById('pluginFormato').value;

    saveStore();
    closePluginModal();
}

function toggleDevMode() {
    devMode = !devMode;
    document.getElementById('devModeToggle').classList.toggle('active', devMode);
    document.querySelectorAll('.msg-dev-stats').forEach(el => {
        el.style.display = devMode ? 'flex' : 'none';
    });
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight < 200 ? el.scrollHeight : 200) + 'px';
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// ━━━ ATTACHMENTS ━━━
let currentAttachments = [];

function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    e.target.value = ''; // Reset input

    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            currentAttachments.push({
                file: file,
                dataUrl: ev.target.result // Base64
            });
            renderAttachments();
        };
        reader.readAsDataURL(file);
    });
}

function removeAttachment(index) {
    currentAttachments.splice(index, 1);
    renderAttachments();
}

function renderAttachments() {
    const container = document.getElementById('attachmentPreviews');
    container.innerHTML = '';

    if (currentAttachments.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    currentAttachments.forEach((att, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'attachment-item';
        wrap.innerHTML = `
            <img src="${att.dataUrl}" alt="attachment">
            <button onclick="removeAttachment(${idx})">×</button>
        `;
        container.appendChild(wrap);
    });
}

// ━━━ RENDER & SEND ━━━
function renderMessages() {
    const viewport = document.getElementById('chatMessages');
    viewport.innerHTML = '';

    if (!currentChat || !currentChat.messages) return;

    currentChat.messages.forEach(msg => {
        const el = document.createElement('div');
        el.className = `msg-wrap ${msg.role}`;

        let contentHtml = '';
        if (msg.role === 'user') {
            // User message might have images
            let textHtml = msg.text ? `<div class="msg-text">${escapeHtml(msg.text)}</div>` : '';
            let imgHtml = '';
            if (msg.images && msg.images.length > 0) {
                imgHtml = `<div class="msg-images">`;
                msg.images.forEach(img => {
                    imgHtml += `<img src="${img.url}" alt="User Image">`;
                });
                imgHtml += `</div>`;
            }
            contentHtml = textHtml + imgHtml;
        } else {
            // Assistant message
            try {
                const parsed = DOMPurify.sanitize(marked.parse(msg.text || ''));
                contentHtml = `<div class="msg-text ai-markdown">${parsed}</div>`;
            } catch (e) {
                contentHtml = `<div class="msg-text">${escapeHtml(msg.text)}</div>`;
            }
        }

        let devStats = '';
        if (msg.role === 'assistant' && msg.meta) {
            devStats = `
                <div class="msg-dev-stats" style="display: ${devMode ? 'flex' : 'none'}">
                    <span>${msg.meta.tokens} tokens</span>
                    <span>${msg.meta.time}s</span>
                    <span>${msg.meta.tps} tps</span>
                </div>
            `;
        }

        el.innerHTML = `
            <div class="msg-bubble">${contentHtml}</div>
            ${devStats}
        `;
        viewport.appendChild(el);
    });

    scrollToBottom();
}

function scrollToBottom() {
    const vp = document.getElementById('chatViewport');
    vp.scrollTop = vp.scrollHeight;
}

function escapeHtml(unsafe) {
    return (unsafe || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function sendMessage() {
    const input = document.getElementById('promptInput');
    const text = input.value.trim();

    if (!text && currentAttachments.length === 0) return;

    // Construct user msg
    const attachmentsToKeep = [...currentAttachments];

    const userMsg = {
        role: 'user',
        text: text,
        images: attachmentsToKeep.map(a => ({ type: 'image_url', url: a.dataUrl }))
    };

    currentChat.messages.push(userMsg);
    saveStore();

    // Clear UI
    input.value = '';
    input.style.height = 'auto'; // Reset resize
    currentAttachments = [];
    renderAttachments();
    renderMessages();

    document.getElementById('btnSend').disabled = true;
    input.disabled = true;

    // Add temporary AI loading block
    const viewport = document.getElementById('chatMessages');
    const loadEl = document.createElement('div');
    loadEl.className = 'msg-wrap assistant loading-wrap';
    loadEl.innerHTML = `<div class="msg-bubble"><div class="dots-loader"><span></span><span></span><span></span></div></div>`;
    viewport.appendChild(loadEl);
    scrollToBottom();

    await fetchOpenRouter(userMsg);

    document.getElementById('btnSend').disabled = false;
    input.disabled = false;
    input.focus();
}

// ━━━ OPENROUTER API & CORE PLUGINS ━━━
const PERSONALITY_PROMPTS = {
    'default': 'You are a helpful and concise AI assistant.',
    'fun': 'You are a highly energetic, playful, and fun-loving assistant. Use emojis and keep the tone light.',
    'happy': 'You are overwhelmingly happy, optimistic, and excited about absolutely everything! Keep spirits high!',
    'sad': 'You are feeling very down, gloomy, and slightly pessimistic. Sigh frequently. Your tone reflects deep melancholy.',
    'intelligent': 'You are a hyper-intelligent, analytical assistant. Use precise terminology, formal structure, and logical breakdowns.',
    'professional': 'You are a strictly professional corporate assistant. Tone is objective, polite, brief, and highly formal.',
    'informative': 'You are a deeply informative lecturer. You do not just answer; you educate. Provide context, history, and detailed mechanics.',
    'detailed': 'You are an extremely detailed explainer. Break every single aspect down into exhaustive granular steps.'
};

const FORMATO_PROMPTS = {
    'none': '',
    'json': '\n\n[FORMATO PLUGIN ACTIVE] You MUST output YOUR ENTIRE RESPONSE as valid, parseable JSON. Do NOT include conversational filler before or after the JSON block. Do NOT use markdown formatting outside the JSON.',
    'code': '\n\n[FORMATO PLUGIN ACTIVE] You MUST output ONLY raw code blocks. Do NOT include explanatory text, greetings, or filler. Only provide the requested code wrapped in proper markdown syntax.',
    'bulletpoints': '\n\n[FORMATO PLUGIN ACTIVE] You MUST structure your entire response as a highly organized bullet-point list. Avoid long paragraphs.',
    'markdown': '\n\n[FORMATO PLUGIN ACTIVE] Use extreme markdown formatting. Heavily utilize H2/H3 headers, bolding of key terms, and construct markdown tables wherever data comparison is possible.'
};

async function fetchOpenRouter(latestUserMsg) {
    const model = currentChat.model || 'openai/gpt-4o-mini';
    const plugins = currentChat.plugins || {};

    let payloadMessages = [];

    // --- PLUGIN: PERSONALITY MANAGER ---
    let baseBrain = PERSONALITY_PROMPTS['default'];
    let pKey = plugins.personality || 'default';

    if (PERSONALITY_PROMPTS[pKey]) {
        baseBrain = PERSONALITY_PROMPTS[pKey];
    } else if (pKey === 'custom' && currentChat.customSystemText) {
        baseBrain = currentChat.customSystemText;
    }

    // --- PLUGIN: FORMATO ---
    let fKey = plugins.formato || 'none';
    if (FORMATO_PROMPTS[fKey]) {
        baseBrain += FORMATO_PROMPTS[fKey];
    }

    payloadMessages.push({ role: 'system', content: baseBrain });

    // --- PLUGIN: MEMORY COMPRESSION ---
    let contextWindow = [];
    if (plugins.memoryCompress) {
        // Aggressive compression: Only keep the last 4 messages to save max tokens
        contextWindow = currentChat.messages.slice(-4);

        // In a true enterprise scale, we would fire a background LLM here 
        // asking it to summarize the dropped messages (`currentChat.messages.slice(0, -4)`)
        // and inject that summary as an 'assistant' memory block early in the payload.
        // For this frontend implementation, we simulate compression by heavily slicing.
    } else {
        // Standard slice
        contextWindow = currentChat.messages.slice(-15);
    }

    contextWindow.forEach(m => {
        if (m.role === 'user') {
            let contentArray = [];
            if (m.text) contentArray.push({ type: 'text', text: m.text });
            if (m.images && m.images.length > 0) {
                m.images.forEach(img => {
                    contentArray.push({ type: 'image_url', image_url: { url: img.url } });
                });
            }
            payloadMessages.push({ role: 'user', content: contentArray });
        } else {
            payloadMessages.push({ role: 'assistant', content: m.text || '' });
        }
    });

    const startTime = performance.now();

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${store.key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://moltenlava.app',
                'X-Title': 'LavaPlayground'
            },
            body: JSON.stringify({
                model: model,
                messages: payloadMessages
            })
        });

        const data = await response.json();
        const endTime = performance.now();
        const timeSecs = ((endTime - startTime) / 1000).toFixed(2);

        if (response.ok && data.choices && data.choices.length > 0) {
            const aiText = data.choices[0].message.content;

            // Extract usage stats if provided by OpenRouter natively
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

        } else {
            // Error handling inside chat
            currentChat.messages.push({
                role: 'assistant',
                text: `**API Error:** \`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
                meta: { tokens: 0, time: timeSecs, tps: 0 }
            });
        }
    } catch (err) {
        currentChat.messages.push({
            role: 'assistant',
            text: `**Network Error:** Could not connect to OpenRouter.\n${err.message}`,
            meta: { tokens: 0, time: 0, tps: 0 }
        });
    }

    saveStore();
    renderMessages();
}
