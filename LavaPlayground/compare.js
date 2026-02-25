const STORAGE_KEY = 'LavaPlayground_v1';
let store = { chats: [], key: '' };
let devMode = false;

window.addEventListener('DOMContentLoaded', () => {
    getStore();
    if (!store.key) {
        alert("No API Key found. Redirecting to Hub.");
        window.location.href = 'index.html';
        return;
    }

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
    } catch (e) { }
}

function checkCustomA() {
    const s = document.getElementById('modelSelectA').value;
    document.getElementById('customInputA').classList.toggle('hidden', s !== 'custom');
}

function checkCustomB() {
    const s = document.getElementById('modelSelectB').value;
    document.getElementById('customInputB').classList.toggle('hidden', s !== 'custom');
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight < 200 ? el.scrollHeight : 200) + 'px';
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCompareMessage();
    }
}

let historyA = [];
let historyB = [];

function escapeHtml(unsafe) {
    return (unsafe || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appendMessage(paneId, role, text, meta) {
    const vp = document.getElementById(paneId);
    const el = document.createElement('div');
    el.className = `msg-wrap ${role}`;

    let contentHtml = '';
    if (role === 'user') {
        contentHtml = `<div class="msg-text">${escapeHtml(text)}</div>`;
    } else {
        try {
            const parsed = DOMPurify.sanitize(marked.parse(text));
            contentHtml = `<div class="msg-text ai-markdown">${parsed}</div>`;
        } catch {
            contentHtml = `<div class="msg-text">${escapeHtml(text)}</div>`;
        }
    }

    let devStats = '';
    if (meta) {
        devStats = `
            <div class="msg-dev-stats" style="display:flex; margin-top:8px;">
                <span>${meta.tokens} tokens</span>
                <span>${meta.time}s</span>
                <span>${meta.tps} tps</span>
            </div>
        `;
    }

    el.innerHTML = `<div class="msg-bubble">${contentHtml}</div>${devStats}`;
    vp.appendChild(el);
    vp.scrollTop = vp.scrollHeight;

    return el;
}

async function sendCompareMessage() {
    const input = document.getElementById('compareInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    // UI Updates
    appendMessage('messagesA', 'user', text);
    appendMessage('messagesB', 'user', text);

    historyA.push({ role: 'user', content: text });
    historyB.push({ role: 'user', content: text });

    const btn = document.getElementById('btnCompareSend');
    btn.disabled = true;
    input.disabled = true;

    // Loading dots
    const loadA = document.createElement('div');
    loadA.className = 'msg-wrap assistant loading-wrap';
    loadA.innerHTML = `<div class="msg-bubble"><div class="dots-loader"><span></span><span></span><span></span></div></div>`;
    document.getElementById('messagesA').appendChild(loadA);

    const loadB = document.createElement('div');
    loadB.className = 'msg-wrap assistant loading-wrap';
    loadB.innerHTML = `<div class="msg-bubble"><div class="dots-loader"><span></span><span></span><span></span></div></div>`;
    document.getElementById('messagesB').appendChild(loadB);

    // Get Models
    let modA = document.getElementById('modelSelectA').value;
    if (modA === 'custom') modA = document.getElementById('customInputA').value || 'openai/gpt-4o-mini';

    let modB = document.getElementById('modelSelectB').value;
    if (modB === 'custom') modB = document.getElementById('customInputB').value || 'openai/gpt-4o-mini';

    // Fire concurrently
    const p1 = hitAPI(modA, historyA).then(res => {
        loadA.remove();
        appendMessage('messagesA', 'assistant', res.text, res.meta);
        historyA.push({ role: 'assistant', content: res.text });
    });

    const p2 = hitAPI(modB, historyB).then(res => {
        loadB.remove();
        appendMessage('messagesB', 'assistant', res.text, res.meta);
        historyB.push({ role: 'assistant', content: res.text });
    });

    await Promise.all([p1, p2]);

    btn.disabled = false;
    input.disabled = false;
    input.focus();
}

async function hitAPI(model, history) {
    const startTime = performance.now();
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${store.key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://moltenlava.app',
                'X-Title': 'LavaPlayground Compare'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: 'You are a helpful AI.' }, ...history.slice(-6)]
            })
        });

        const data = await response.json();
        const endTime = performance.now();
        const timeSecs = ((endTime - startTime) / 1000).toFixed(2);

        if (response.ok && data.choices && data.choices.length > 0) {
            const aiText = data.choices[0].message.content;
            const totalTokens = data.usage ? data.usage.total_tokens : 0;
            const tps = totalTokens > 0 ? (data.usage.completion_tokens / timeSecs).toFixed(1) : 0;

            return { text: aiText, meta: { tokens: totalTokens, time: timeSecs, tps: tps } };
        } else {
            return { text: `**API Error**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``, meta: { tokens: 0, time: timeSecs, tps: 0 } };
        }
    } catch (err) {
        return { text: `**Network Error:** Could not connect.\n${err.message}`, meta: null };
    }
}
