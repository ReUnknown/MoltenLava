window.AppModal = {
    init() {
        if (document.getElementById('app-modal-overlay')) return;
        const style = document.createElement('style');
        style.textContent = `
            #app-modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:999999; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.2s; }
            #app-modal-overlay.visible { opacity:1; pointer-events:auto; }
            .app-modal-box { background:#18181b; border:1px solid #27272a; border-radius:12px; width:90%; max-width:400px; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); transform:scale(0.95); transition:transform 0.2s; display:flex; flex-direction:column; gap:16px; font-family:'Inter',sans-serif; }
            #app-modal-overlay.visible .app-modal-box { transform:scale(1); }
            .app-modal-title { color:#fff; font-size:1.2rem; font-weight:600; margin:0; }
            .app-modal-msg { color:#a1a1aa; font-size:0.95rem; line-height:1.5; margin:0; }
            .app-modal-input { background:#09090b; border:1px solid #27272a; color:#fff; padding:10px 12px; border-radius:6px; font-size:1rem; width:100%; box-sizing:border-box; outline:none; transition:border-color 0.2s; display:none; }
            .app-modal-input:focus { border-color:#ff5e3a; }
            .app-modal-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:8px; }
            .app-modal-btn { padding:8px 16px; border-radius:6px; font-size:0.9rem; font-weight:500; cursor:pointer; transition:all 0.2s; border:none; }
            .app-modal-btn.cancel { background:transparent; color:#a1a1aa; border:1px solid #3f3f46; }
            .app-modal-btn.cancel:hover { background:#27272a; color:#fff; }
            .app-modal-btn.confirm { background:#ff5e3a; color:#fff; }
            .app-modal-btn.confirm:hover { background:#ea580c; }
            .app-modal-list { display:none; max-height:200px; overflow-y:auto; background:#121214; border:1px solid #27272a; border-radius:6px; margin-top:8px; }
            .app-modal-list-item { padding:10px 12px; border-bottom:1px solid #1f1f23; cursor:pointer; color:#a1a1aa; font-size:0.9rem; transition:background 0.2s; }
            .app-modal-list-item:last-child { border-bottom:none; }
            .app-modal-list-item:hover, .app-modal-list-item.selected { background:#27272a; color:#fff; }
        `;
        document.head.appendChild(style);
        const overlay = document.createElement('div');
        overlay.id = 'app-modal-overlay';
        overlay.innerHTML = `
            <div class="app-modal-box">
                <h3 class="app-modal-title" id="app-modal-title"></h3>
                <p class="app-modal-msg" id="app-modal-msg"></p>
                <input type="text" class="app-modal-input" id="app-modal-input">
                <div class="app-modal-list" id="app-modal-list"></div>
                <div class="app-modal-actions">
                    <button class="app-modal-btn cancel" id="app-modal-btn-cancel">Cancel</button>
                    <button class="app-modal-btn confirm" id="app-modal-btn-confirm">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },
    show(o) {
        return new Promise(r => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
            // slight delay to ensure DOM is ready if just appended
            setTimeout(() => {
                const ov = document.getElementById('app-modal-overlay');
                if (!ov) return r(o.type === 'prompt' ? null : false);
                const tEl = document.getElementById('app-modal-title');
                const mEl = document.getElementById('app-modal-msg');
                const iEl = document.getElementById('app-modal-input');
                const listEl = document.getElementById('app-modal-list');
                const cBtn = document.getElementById('app-modal-btn-cancel');
                const kBtn = document.getElementById('app-modal-btn-confirm');

                tEl.textContent = o.title || 'Attention'; tEl.style.display = o.title ? 'block' : 'none';
                mEl.textContent = o.msg || ''; mEl.style.display = o.msg ? 'block' : 'none';
                listEl.style.display = 'none'; listEl.innerHTML = '';

                let selectedValue = null;

                if (o.type === 'prompt') {
                    iEl.style.display = 'block'; iEl.value = o.defaultText || '';
                } else if (o.type === 'select') {
                    iEl.style.display = 'none';
                    listEl.style.display = 'block';
                    if (o.items && o.items.length) {
                        o.items.forEach(item => {
                            const d = document.createElement('div');
                            d.className = 'app-modal-list-item';
                            d.textContent = item.label;
                            d.onclick = () => {
                                Array.from(listEl.children).forEach(c => c.classList.remove('selected'));
                                d.classList.add('selected');
                                selectedValue = item.value;
                            };
                            listEl.appendChild(d);
                        });
                        // Select first by default
                        listEl.firstChild.classList.add('selected');
                        selectedValue = o.items[0].value;
                    } else {
                        listEl.innerHTML = '<div style="padding:10px;color:#52525b;text-align:center;font-size:0.85rem;">No items available</div>';
                    }
                } else {
                    iEl.style.display = 'none';
                }
                kBtn.textContent = o.confirmText || 'OK';

                const cln = () => { ov.classList.remove('visible'); cBtn.onclick = null; kBtn.onclick = null; iEl.onkeydown = null; };
                cBtn.onclick = () => { cln(); r(null); };
                kBtn.onclick = () => { cln(); r(o.type === 'prompt' ? iEl.value : (o.type === 'select' ? selectedValue : true)); };
                iEl.onkeydown = (e) => { if (e.key === 'Enter') kBtn.click(); if (e.key === 'Escape') cBtn.click(); };

                ov.classList.add('visible');
                if (o.type === 'prompt') setTimeout(() => { iEl.focus(); iEl.select(); }, 100);
                else setTimeout(() => kBtn.focus(), 100);
            }, 10);
        });
    },
    alert(msg, title = 'Alert') { return this.show({ type: 'alert', msg, title, confirmText: 'OK' }); },
    confirm(msg, title = 'Confirm') { return this.show({ type: 'confirm', msg, title }); },
    prompt(msg, defaultText = '', title = 'Input Required') { return this.show({ type: 'prompt', msg, defaultText, title }); },
    selectItem(items, msg = 'Select an item', title = 'Choose Item') { return this.show({ type: 'select', items, msg, title }); },

    // Global API Key Prompt
    requestGlobalApiKey() {
        return new Promise(resolve => {
            if (document.getElementById('lava-apikey-modal')) return resolve(null);

            const style = document.createElement('style');
            style.textContent = `
                #lava-apikey-modal { position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); z-index:9999999; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.3s ease; font-family:'Inter',sans-serif; }
                #lava-apikey-modal.visible { opacity:1; pointer-events:auto; }
                .lava-ak-box { background:#0a0a0c; border:1px solid rgba(192,132,252,0.3); border-radius:16px; width:90%; max-width:480px; padding:2.5rem; box-shadow:0 0 40px rgba(192,132,252,0.1); transform:translateY(20px); transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display:flex; flex-direction:column; gap:16px; position:relative; overflow:hidden; }
                #lava-apikey-modal.visible .lava-ak-box { transform:translateY(0); }
                .lava-ak-box::before { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(circle at center, rgba(192,132,252,0.1) 0%, transparent 50%); z-index:0; pointer-events:none; }
                .lava-ak-brand { display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:1rem; position:relative; z-index:1; }
                .lava-ak-title { font-size:1.8rem; font-weight:800; color:#fff; text-align:center; letter-spacing:-0.03em; margin:0; position:relative; z-index:1; }
                .lava-ak-desc { color:#a1a1aa; font-size:1rem; line-height:1.5; text-align:center; margin-bottom:1rem; position:relative; z-index:1; }
                .lava-ak-input { background:#121216; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:14px 16px; border-radius:8px; font-size:1rem; width:100%; box-sizing:border-box; outline:none; transition:border-color 0.2s, box-shadow 0.2s; position:relative; z-index:1; }
                .lava-ak-input:focus { border-color:#c084fc; box-shadow:0 0 0 2px rgba(192,132,252,0.2); }
                .lava-ak-btn { background:linear-gradient(135deg, #c084fc, #ec4899); color:#fff; border:none; padding:14px; border-radius:8px; font-size:1.05rem; font-weight:600; cursor:pointer; width:100%; transition:transform 0.2s, box-shadow 0.2s; position:relative; z-index:1; }
                .lava-ak-btn:hover { transform:translateY(-2px); box-shadow:0 10px 20px rgba(192,132,252,0.3); }
                .lava-ak-footer { color:#71717a; font-size:0.8rem; text-align:center; margin-top:1rem; position:relative; z-index:1; }
            `;
            document.head.appendChild(style);

            const overlay = document.createElement('div');
            overlay.id = 'lava-apikey-modal';
            overlay.innerHTML = `
                <div class="lava-ak-box">
                    <div class="lava-ak-brand">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z" fill="url(#lava-grad)" />
                            <defs>
                                <linearGradient id="lava-grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#c084fc"/>
                                    <stop offset="1" stop-color="#ec4899"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h2 class="lava-ak-title">LavaTime Auth</h2>
                    <p class="lava-ak-desc">Please enter your OpenRouter API Key to unlock LavaAI and LavaPlayground. This key is stored locally and securely.</p>
                    <input type="password" class="lava-ak-input" id="lava-ak-input" placeholder="sk-or-v1-..." autocomplete="off">
                    <button class="lava-ak-btn" id="lava-ak-btn">Unlock Intelligence</button>
                    <p class="lava-ak-footer">Your key never leaves your browser.</p>
                </div>
            `;
            document.body.appendChild(overlay);

            setTimeout(() => {
                const ov = document.getElementById('lava-apikey-modal');
                const btn = document.getElementById('lava-ak-btn');
                const inp = document.getElementById('lava-ak-input');

                ov.classList.add('visible');
                inp.focus();

                const submitKey = () => {
                    const val = inp.value.trim();
                    if (val) {
                        localStorage.setItem('MoltenLava_API_Key', val);
                        ov.classList.remove('visible');
                        setTimeout(() => { ov.remove(); style.remove(); resolve(val); }, 300);
                    }
                };

                btn.onclick = submitKey;
                inp.onkeydown = (e) => { if (e.key === 'Enter') submitKey(); };
            }, 10);
        });
    }
};
