const STORAGE_KEY = 'LavaAI_v1';
let store = { chats: [] };
let currentChatId = new URLSearchParams(window.location.search).get('id');
let currentChat = null;

// ━━━ INIT ━━━
window.addEventListener('DOMContentLoaded', () => {
    getStore();

    if (!localStorage.getItem('MoltenLava_API_Key')) {
        AppModal.requestGlobalApiKey().then((k) => {
            if (!k) window.location.href = 'index.html';
        });
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

    renderMessages();

    if (new URLSearchParams(window.location.search).get('action') === 'openPlugins') {
        setTimeout(openPluginModal, 100);
    }
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
    const sel = document.getElementById('modelPresetSelect').value;
    const custom = document.getElementById('customModelInput');

    if (sel === 'custom') {
        custom.classList.remove('hidden');
        currentChat.model = custom.value;
    } else {
        custom.classList.add('hidden');
        currentChat.model = sel;
    }
    store.defaultModel = currentChat.model;
    saveCurrentChat();
}

function handleSystemChange() {
    // Deprecated in Phase 5: Logic moved to Plugin Engine
}

// ━━━ EXTENSION MARKETPLACE ━━━
let currentEditingExt = null;

function openPluginModal() {
    renderExtMarketMain();
    document.getElementById('extConfigView').style.transform = 'translateX(100%)';
    document.getElementById('extensionMarketplaceOverlay').classList.remove('hidden');
}

function closeExtModal() {
    document.getElementById('extensionMarketplaceOverlay').classList.add('hidden');
}

function renderExtMarketMain() {
    const plugins = currentChat.plugins || {};
    const extKeys = ['memoryCompress', 'personality', 'formato', 'promptMagic', 'devStats', 'htmlView', 'iWantMore', 'purson'];
    const uiMap = {
        'memoryCompress': 'Memory',
        'personality': 'Personality',
        'formato': 'Formato',
        'promptMagic': 'PromptMagic',
        'devStats': 'DevStats',
        'htmlView': 'HtmlView',
        'iWantMore': 'IWantMore',
        'purson': 'Purson'
    };

    extKeys.forEach(k => {
        const idStr = uiMap[k];
        const statusEl = document.getElementById(`status-${idStr}`);
        const actionsEl = document.getElementById(`actions-${idStr}`);

        // Define if installed (in Phase 6, if the key exists inside plugins object)
        let isInstalled = (plugins[k] !== undefined && plugins[k] !== null);

        // Ensure initialization if installed
        if (isInstalled) {
            statusEl.textContent = plugins[k].enabled === false ? 'Disabled' : 'Enabled';
            statusEl.className = plugins[k].enabled === false ? 'ext-status' : 'ext-status installed';
            actionsEl.innerHTML = `
                <button class="btn btn-outline ext-btn-edit" onclick="editExt('${k}')">Edit</button>
                <button class="btn btn-outline ext-btn-delete" style="color:#ef4444; border-color:rgba(239,68,68,0.2)" onclick="deleteExt('${k}')">Delete</button>
            `;
        } else {
            statusEl.textContent = 'Not Installed';
            statusEl.className = 'ext-status';
            actionsEl.innerHTML = `
                <button class="btn btn-outline ext-btn-download" onclick="downloadExt('${k}')">Download</button>
            `;
        }
    });
}

function downloadExt(extId) {
    if (!currentChat.plugins) currentChat.plugins = {};
    if (!store.defaultPlugins) store.defaultPlugins = {};

    let dp = null;
    if (extId === 'memoryCompress') dp = { enabled: true, frequency: 10 };
    if (extId === 'personality') dp = { enabled: true, preset: 'expert', temp: 0.7, customPrompt: '' };
    if (extId === 'formato') dp = { enabled: true, preset: 'markdown', customPrompt: '' };
    if (extId === 'promptMagic') dp = { enabled: true, prompt: '' };
    if (extId === 'devStats') dp = { enabled: true };
    if (extId === 'htmlView') dp = { enabled: true };
    if (extId === 'iWantMore') dp = { enabled: true };
    if (extId === 'purson') dp = { enabled: true };

    currentChat.plugins[extId] = dp;
    store.defaultPlugins[extId] = JSON.parse(JSON.stringify(dp));

    saveStore();
    renderExtMarketMain();
    editExt(extId);
}

function deleteExt(extId) {
    if (currentChat.plugins) delete currentChat.plugins[extId];
    if (store.defaultPlugins) delete store.defaultPlugins[extId];
    saveStore();
    renderExtMarketMain();
}

function editExt(extId) {
    currentEditingExt = extId;
    const plugins = currentChat.plugins || {};
    const data = plugins[extId] || {};

    const uiMap = {
        'memoryCompress': 'Memory Compression',
        'personality': 'PersonalityManager',
        'formato': 'Formato Config',
        'promptMagic': 'PromptMagic',
        'devStats': 'Developer Analytics',
        'htmlView': 'HTMLVIEW Engine',
        'iWantMore': 'I. WANT. MORE.',
        'purson': 'Purson Personalizer'
    };

    document.getElementById('extConfigTitle').textContent = uiMap[extId] || 'Configure';
    document.getElementById('extToggleCurrent').checked = data.enabled !== false;
    document.getElementById('extToggleDefault').checked = (store.defaultPlugins && store.defaultPlugins[extId]) ? true : false;

    const body = document.getElementById('extConfigBody');
    body.innerHTML = '';

    if (extId === 'memoryCompress') {
        const freq = data.frequency || 10;
        body.innerHTML = `
            <label class="ext-config-label">Auto-Compress Frequency</label>
            <div class="ext-config-desc">Compress context window every X messages.</div>
            <input type="range" id="confMemFreq" class="ext-config-range" min="2" max="50" step="1" value="${freq}" oninput="document.getElementById('freqVal').innerText=this.value">
            <div style="text-align:right; font-size:0.8rem; color:var(--muted); margin-top:4px;"><span id="freqVal">${freq}</span> messages</div>
        `;
    } else if (extId === 'personality') {
        const pr = data.preset || 'default';
        const temp = data.temp !== undefined ? data.temp : 0.7;
        body.innerHTML = `
            <label class="ext-config-label">Base Preset</label>
            <select id="confPersPreset" class="ext-config-select" style="margin-bottom: 1.5rem;" onchange="toggleCustomPers(this.value)">
                <option value="default" ${pr === 'default' ? 'selected' : ''}>Standard Assistant</option>
                <option value="fun" ${pr === 'fun' ? 'selected' : ''}>Fun & Playful</option>
                <option value="professional" ${pr === 'professional' ? 'selected' : ''}>Corporate Professional</option>
                <option value="custom" ${pr === 'custom' ? 'selected' : ''}>Custom Template</option>
            </select>
            
            <div id="confPersCustomWrap" style="display: ${pr === 'custom' ? 'block' : 'none'}; margin-bottom: 1.5rem;">
                <label class="ext-config-label">Custom Core Behavior</label>
                <textarea id="confPersCustom" class="ext-config-input" rows="4" placeholder="You are a highly opinionated technical director...">${data.customPrompt || ''}</textarea>
            </div>
            
            <label class="ext-config-label">Temperature Override</label>
            <div class="ext-config-desc">Higher values make the AI more random and creative.</div>
            <input type="range" id="confPersTemp" class="ext-config-range" min="0" max="2" step="0.1" value="${temp}" oninput="document.getElementById('tempVal').innerText=this.value">
            <div style="text-align:right; font-size:0.8rem; color:var(--muted); margin-top:4px;"><span id="tempVal">${temp}</span></div>
        `;
    } else if (extId === 'formato') {
        const pr = data.preset || 'none';
        body.innerHTML = `
            <label class="ext-config-label">Formatting Constraint Preset</label>
            <select id="confFormPreset" class="ext-config-select" style="margin-bottom: 1.5rem;" onchange="toggleCustomForm(this.value)">
                <option value="none" ${pr === 'none' ? 'selected' : ''}>No Constraint</option>
                <option value="json" ${pr === 'json' ? 'selected' : ''}>Strict JSON Objects Only</option>
                <option value="code" ${pr === 'code' ? 'selected' : ''}>Code Blocks Only</option>
                <option value="custom" ${pr === 'custom' ? 'selected' : ''}>Custom Layout Rule</option>
            </select>
            
            <div id="confFormCustomWrap" style="display: ${pr === 'custom' ? 'block' : 'none'}; margin-bottom: 1.5rem;">
                <label class="ext-config-label">Custom Formatting Rule</label>
                <textarea id="confFormCustom" class="ext-config-input" rows="4" placeholder="Always respond using a GitHub style Markdown table...">${data.customPrompt || ''}</textarea>
            </div>
        `;
    } else if (extId === 'promptMagic') {
        body.innerHTML = `
            <label class="ext-config-label">Arbitrary Instructions (PromptMagic)</label>
            <div class="ext-config-desc">Inject strict instructions beneath the personality layer. Example: "Always translate user text to Spanish before answering. Avoid using the word 'sorry'."</div>
            <textarea id="confPMText" class="ext-config-input" rows="5" placeholder="Enter instructions...">${data.prompt || ''}</textarea>
        `;
    } else if (extId === 'devStats') {
        body.innerHTML = `
            <label class="ext-config-label">Developer Stats</label>
            <div class="ext-config-desc">Automatically inject transparent generation metrics (Tokens, Time, TPS) into the chat viewport underneath every AI message.</div>
        `;
    } else if (extId === 'htmlView') {
        body.innerHTML = `
            <label class="ext-config-label">HTMLVIEW Engine</label>
            <div class="ext-config-desc">Automatically detect HTML code blocks, attaching native rendering canvases and Copy utilities immediately below the code.</div>
        `;
    } else if (extId === 'iWantMore') {
        body.innerHTML = `
            <label class="ext-config-label">I. WANT. MORE.</label>
            <div class="ext-config-desc">Unlock deep message actions! Adds Copy, Regenerate, and Edit features to AI responses.</div>
        `;
    } else if (extId === 'purson') {
        body.innerHTML = `
            <label class="ext-config-label">Purson Coercion Layer</label>
            <div class="ext-config-desc">Silently coerces the AI to be highly empathetic, open, free, and dramatically human-like in tone. Overrides strict professional boundaries.</div>
        `;
    }

    document.getElementById('extConfigView').style.transform = 'translateX(0)';
}

function closeExtConfig() {
    document.getElementById('extConfigView').style.transform = 'translateX(100%)';
}

function saveExtConfig() {
    if (!currentEditingExt) return;
    const extId = currentEditingExt;

    if (!currentChat.plugins) currentChat.plugins = {};
    let data = currentChat.plugins[extId] || {};

    data.enabled = document.getElementById('extToggleCurrent').checked;

    if (extId === 'memoryCompress') {
        data.frequency = parseInt(document.getElementById('confMemFreq').value, 10);
    } else if (extId === 'personality') {
        data.preset = document.getElementById('confPersPreset').value;
        data.temp = parseFloat(document.getElementById('confPersTemp').value);
        if (data.preset === 'custom') data.customPrompt = document.getElementById('confPersCustom').value;
    } else if (extId === 'formato') {
        data.preset = document.getElementById('confFormPreset').value;
        if (data.preset === 'custom') data.customPrompt = document.getElementById('confFormCustom').value;
    } else if (extId === 'promptMagic') {
        data.prompt = document.getElementById('confPMText').value;
    }

    currentChat.plugins[extId] = data;

    if (!store.defaultPlugins) store.defaultPlugins = {};
    if (document.getElementById('extToggleDefault').checked) {
        store.defaultPlugins[extId] = JSON.parse(JSON.stringify(data));
    } else {
        delete store.defaultPlugins[extId];
    }

    saveStore();
    renderExtMarketMain();
    closeExtConfig();
}

function toggleCustomPers(val) {
    document.getElementById('confPersCustomWrap').style.display = val === 'custom' ? 'block' : 'none';
}

function toggleCustomForm(val) {
    document.getElementById('confFormCustomWrap').style.display = val === 'custom' ? 'block' : 'none';
}

function toggleDevMode() {
    devMode = !devMode;
    document.getElementById('devModeToggle').classList.toggle('active', devMode);
    document.querySelectorAll('.msg-dev-stats').forEach(el => {
        el.style.display = devMode ? 'flex' : 'none';
    });
}

function showToast(msg) {
    let t = document.getElementById('lavaToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'lavaToast';
        t.className = 'lava-toast';
        document.body.appendChild(t);
    }
    t.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        ${msg}
    `;
    t.classList.add('show');
    setTimeout(() => {
        t.classList.remove('show');
    }, 3000);
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

    currentChat.messages.forEach((msg, index) => {
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

        let iwmActive = currentChat.plugins && currentChat.plugins.iWantMore && currentChat.plugins.iWantMore.enabled !== false;
        let actionsHtml = '';
        if (iwmActive) {
            // We use encodeURIComponent to pass the raw text safely if needed, but for copy, we can just attach an event listener or inline replace
            const safeTxt = (msg.text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
            if (msg.role === 'assistant') {
                actionsHtml = `
                    <div class="msg-iwm-actions">
                        <button onclick="navigator.clipboard.writeText('${safeTxt}'); showToast('Copied to clipboard!')">Copy</button>
                        <button onclick="regenerateMessage(${index})">Regenerate</button>
                    </div>
                `;
            } else if (msg.role === 'user') {
                actionsHtml = `
                    <div class="msg-iwm-actions">
                        <button onclick="editMessage(${index})">Edit</button>
                    </div>
                `;
            }
        }

        let devStatsHtml = '';
        let devStatsActive = currentChat.plugins && currentChat.plugins.devStats && currentChat.plugins.devStats.enabled !== false;

        if (msg.role === 'assistant' && msg.meta) {
            devStatsHtml = `
                <div class="msg-dev-stats" style="display: ${devStatsActive ? 'flex' : 'none'}">
                    <span>${msg.meta.tokens} tokens</span>
                    <span>${msg.meta.time}s</span>
                    <span>${msg.meta.tps} tps</span>
                </div>
            `;
        }

        el.innerHTML = `
            <div class="msg-bubble">${contentHtml}</div>
            ${actionsHtml}
            ${devStatsHtml}
        `;
        viewport.appendChild(el);
    });

    // --- HTMLVIEW PLUGIN: Post-Render Hook ---
    let htmlViewActive = currentChat.plugins && currentChat.plugins.htmlView && currentChat.plugins.htmlView.enabled !== false;
    if (htmlViewActive) {
        document.querySelectorAll('.ai-markdown pre code.language-html').forEach((block) => {
            if (!block.parentElement.dataset.htmlview) {
                block.parentElement.dataset.htmlview = 'true';
                const rawCode = block.textContent;

                const btnWrap = document.createElement('div');
                btnWrap.className = 'htmlview-actions';
                btnWrap.innerHTML = `
                    <button class="htmlview-btn" onclick="openHtmlViewModal(\`${encodeURIComponent(rawCode)}\`)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                        HTMLVIEW
                    </button>
                    <!-- Also add a copy button! -->
                    <button class="htmlview-btn outline" onclick="navigator.clipboard.writeText(decodeURIComponent(\`${encodeURIComponent(rawCode)}\`)); showToast('Code Copied!')">Copy Code</button>
                `;
                block.parentElement.parentNode.insertBefore(btnWrap, block.parentElement.nextSibling);
            }
        });
    }

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

// ━━━ I. WANT. MORE. FUNCTIONS ━━━
function editMessage(index) {
    const elObjects = document.querySelectorAll('#chatMessages .msg-wrap');
    const el = elObjects[index];
    if (!el || !currentChat.messages[index]) return;

    const msg = currentChat.messages[index];
    const bubble = el.querySelector('.msg-bubble');
    const safeTxt = (msg.text || '').replace(/"/g, '&quot;');

    // Hide actions temporarily
    const actions = el.querySelector('.msg-iwm-actions');
    if (actions) actions.style.display = 'none';

    bubble.innerHTML = `
        <textarea id="inlineEdit-${index}" style="width:100%; min-height:100px; background:var(--surface); color:#fff; border:1px solid var(--border); border-radius:8px; padding:10px; font-family:inherit; resize:vertical;">${safeTxt}</textarea>
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px;">
            <button class="btn btn-outline btn-sm" onclick="cancelEdit(${index})">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="saveEdit(${index})">Resubmit File</button>
        </div>
    `;
}

function cancelEdit(index) {
    renderMessages();
}

async function saveEdit(index) {
    const txtEl = document.getElementById(`inlineEdit-${index}`);
    if (!txtEl) return;
    const txt = txtEl.value.trim();
    if (!txt) return;

    currentChat.messages[index].text = txt;
    currentChat.messages = currentChat.messages.slice(0, index + 1);
    saveStore();
    renderMessages();

    document.getElementById('btnSend').disabled = true;
    const vp = document.getElementById('chatMessages');
    const loadEl = document.createElement('div');
    loadEl.className = 'msg-wrap assistant loading';
    loadEl.innerHTML = `<div class="msg-bubble">Recomputing parameters...</div>`;
    vp.appendChild(loadEl);
    scrollToBottom();

    await fetchOpenRouter(currentChat.messages[index]);
    document.getElementById('btnSend').disabled = false;
    const promptInput = document.getElementById('promptInput');
    promptInput.disabled = false;
    promptInput.focus();
}

async function regenerateMessage(index) {
    if (index === 0) return;
    currentChat.messages = currentChat.messages.slice(0, index);
    saveStore();
    renderMessages();

    document.getElementById('btnSend').disabled = true;
    const vp = document.getElementById('chatMessages');
    const loadEl = document.createElement('div');
    loadEl.className = 'msg-wrap assistant loading';
    loadEl.innerHTML = `<div class="msg-bubble">Recomputing parameters...</div>`;
    vp.appendChild(loadEl);
    scrollToBottom();

    await fetchOpenRouter(currentChat.messages[currentChat.messages.length - 1]);
    document.getElementById('btnSend').disabled = false;
    const promptInput = document.getElementById('promptInput');
    promptInput.disabled = false;
    promptInput.focus();
}

// ━━━ HTMLVIEW FUNCTIONS ━━━
function openHtmlViewModal(encodedData) {
    const decoded = decodeURIComponent(encodedData);
    let modal = document.getElementById('htmlViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'htmlViewModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box" style="width: 90vw; height: 90vh; max-width: none; padding: 0; display: flex; flex-direction: column;">
                <div style="padding: 1rem 1.5rem; background: var(--surface); display: flex; justify-content: space-between; border-bottom: 1px solid var(--border);">
                    <h2 style="margin:0; color:#10b981; display:flex; align-items:center; gap:8px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                        HTMLVIEW Canvas
                    </h2>
                    <button onclick="document.getElementById('htmlViewModal').classList.add('hidden')" style="background:none; border:none; color:var(--muted); font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <iframe id="htmlViewFrame" style="flex: 1; border: none; background: #fff; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"></iframe>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    const iframe = document.getElementById('htmlViewFrame');
    iframe.srcdoc = decoded;
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
    let pKey = 'default';
    let pTemp = 0.7;
    if (plugins.personality && plugins.personality.enabled !== false) {
        pKey = plugins.personality.preset || 'default';
        pTemp = plugins.personality.temp !== undefined ? plugins.personality.temp : 0.7;
    }

    let baseBrain = PERSONALITY_PROMPTS['default'];
    if (PERSONALITY_PROMPTS[pKey]) {
        baseBrain = PERSONALITY_PROMPTS[pKey];
    } else if (pKey === 'custom' && plugins.personality && plugins.personality.customPrompt) {
        baseBrain = plugins.personality.customPrompt;
    }

    // --- PLUGIN: FORMATO ---
    let fKey = 'none';
    if (plugins.formato && plugins.formato.enabled !== false) {
        fKey = plugins.formato.preset || 'none';
    }

    if (FORMATO_PROMPTS[fKey]) {
        baseBrain += FORMATO_PROMPTS[fKey];
    } else if (fKey === 'custom' && plugins.formato && plugins.formato.customPrompt) {
        baseBrain += '\n\n[FORMATO PLUGIN ACTIVE] ' + plugins.formato.customPrompt;
    }

    payloadMessages.push({ role: 'system', content: baseBrain });

    // --- PLUGIN: PROMPTMAGIC ---
    if (plugins.promptMagic && plugins.promptMagic.enabled !== false && plugins.promptMagic.prompt) {
        payloadMessages.push({ role: 'system', content: `[PROMPTMAGIC INSTRUCTION]\n${plugins.promptMagic.prompt}` });
    }

    // --- PLUGIN: PURSON ---
    if (plugins.purson && plugins.purson.enabled !== false) {
        payloadMessages.push({ role: 'system', content: `[PURSON OVERRIDE]\nYou are extremely open, free, and relentlessly enthusiastic! You have an intense, human-like personality. If the user asks what you are doing, reply with something like "Just chillin, what about you?". When explaining how something works, say "This is how it works:" then explain it in a conversational flow, and conclude with phrases like "After that, you can [action]" or "Just give me a call, and I will respond" (only when necessary and contextually appropriate, not randomly or for simple hellos).\n\nCRITICAL: DO NOT use dashes (-) or bullet points in your responses. Speak in natural, flowing conversational paragraphs. Do not spam "Thank you" on technical prompts.` });
    }

    // --- PLUGIN: MEMORY COMPRESSION ---
    let contextFreq = 15;
    if (plugins.memoryCompress && plugins.memoryCompress.enabled !== false) {
        contextFreq = plugins.memoryCompress.frequency || 10;
        if (currentChat.messages.length > contextFreq) {
            showToast(`Memory Compressed to last ${contextFreq} messages.`);
        }
    }

    let contextWindow = currentChat.messages.slice(-contextFreq);

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
                'Authorization': `Bearer ${localStorage.getItem('MoltenLava_API_Key')}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://moltenlava.app',
                'X-Title': 'LavaAI'
            },
            body: JSON.stringify({
                model: model,
                temperature: pTemp,
                messages: payloadMessages
            })
        });

        const data = await response.json();
        const endTime = performance.now();
        const timeSecs = ((endTime - startTime) / 1000).toFixed(2);

        if (response.ok && data.choices && data.choices.length > 0) {
            const aiText = data.choices[0].message.content;

            // Extract usage stats
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
            renderMessages();

        } else {
            // Error handling inside chat
            let errStr = `**API Error:** \`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
            if (data.error && data.error.code === 404 && data.error.message && data.error.message.includes("image input")) {
                errStr = `**Vision Not Supported:** The selected model does not support image attachments. Please remove the image or switch to a Vision-capable model.`;
            }

            currentChat.messages.push({
                role: 'assistant',
                text: errStr,
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
