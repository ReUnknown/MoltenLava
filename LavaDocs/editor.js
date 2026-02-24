// ═══════════════════════════════════════════════════════════════════
// MOLTENDOCS EDITOR v4.0
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'lavaDocs_v1';
    const SLIDES_KEY = 'moltenSlides_v1';
    const AUTOSAVE_DELAY = 800;

    const FONTS = [
        { name: 'Inter', value: 'Inter, sans-serif' },
        { name: 'Arial', value: 'Arial, sans-serif' },
        { name: 'Helvetica', value: 'Helvetica, sans-serif' },
        { name: 'Times New Roman', value: "'Times New Roman', serif" },
        { name: 'Georgia', value: 'Georgia, serif' },
        { name: 'Courier New', value: "'Courier New', monospace" },
        { name: 'Verdana', value: 'Verdana, sans-serif' },
        { name: 'Impact', value: 'Impact, sans-serif' },
        { name: 'Comic Sans MS', value: "'Comic Sans MS', cursive" },
        { name: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
        { name: 'Arial Black', value: "'Arial Black', sans-serif" },
        { name: 'Palatino', value: 'Palatino, serif' },
        { name: 'Garamond', value: 'Garamond, serif' },
        { name: 'Tahoma', value: 'Tahoma, sans-serif' },
        { name: 'Lucida Console', value: "'Lucida Console', monospace" },
        { name: 'Monaco', value: 'Monaco, monospace' },
        { name: 'Century Gothic', value: "'Century Gothic', sans-serif" },
        { name: 'Lucida Sans', value: "'Lucida Sans', sans-serif" },
    ];

    // --- DOM ---
    const docContent = document.getElementById('docContent');
    const docTitle = document.getElementById('docTitle');
    const saveStatus = document.getElementById('saveStatus');
    const wordCountEl = document.getElementById('wordCount');
    const charCountEl = document.getElementById('charCount');
    const pageScaler = document.getElementById('pageScaler');
    const btnBold = document.getElementById('btnBold');
    const btnItalic = document.getElementById('btnItalic');
    const btnUnderline = document.getElementById('btnUnderline');
    const btnStrike = document.getElementById('btnStrike');
    const btnAlignL = document.getElementById('btnAlignL');
    const btnAlignC = document.getElementById('btnAlignC');
    const btnAlignR = document.getElementById('btnAlignR');
    const btnAlignJ = document.getElementById('btnAlignJ');
    const btnUL = document.getElementById('btnUL');
    const btnOL = document.getElementById('btnOL');
    const btnHR = document.getElementById('btnHR');
    const btnBlockquote = document.getElementById('btnBlockquote');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const fmtHeading = document.getElementById('fmtHeading');
    const fmtSize = document.getElementById('fmtSize');
    const fmtColor = document.getElementById('fmtColor');
    const highlightBtn = document.getElementById('highlightBtn');
    const highlightArrow = document.getElementById('highlightArrow');
    const highlightPalette = document.getElementById('highlightPalette');
    const highlightIndicator = document.getElementById('highlightIndicator');
    const highlightColorWheel = document.getElementById('highlightColorWheel');
    const fontPickerBtn = null;
    const fontPickerLabel = null;
    const fontPickerDropdown = null;
    const fontFamily = document.getElementById('fontFamily');
    const btnImage = document.getElementById('btnImage');
    const imageInput = document.getElementById('imageInput');
    const btnHelp = document.getElementById('btnHelp');
    const helpOverlay = document.getElementById('helpOverlay');
    const fileMenuBtn = document.getElementById('fileMenuBtn');
    const fileMenu = document.getElementById('fileMenu');
    const btnImportJSON = document.getElementById('btnImportJSON');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const btnExportPNG = document.getElementById('btnExportPNG');
    const btnPrint = document.getElementById('btnPrint');
    const jsonInput = document.getElementById('jsonInput');
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    const zoomLevel = document.getElementById('zoomLevel');
    const sizeMinus = document.getElementById('sizeMinus');
    const sizePlus = document.getElementById('sizePlus');

    // --- STATE ---
    let currentHighlightColor = '#ffff00';
    let currentZoom = 1;
    let savedRange = null;

    // --- LOAD ---
    const docId = parseInt(new URLSearchParams(window.location.search).get('id'));
    if (!docId) { window.location.href = 'index.html'; return; }
    let allDocs = [];
    try { allDocs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { allDocs = []; }
    let currentDoc = allDocs.find(d => d.id === docId);
    if (!currentDoc) { window.location.href = 'index.html'; return; }

    docContent.innerHTML = currentDoc.content || '<p><br></p>';
    docTitle.textContent = currentDoc.title || 'Untitled';
    document.title = `${currentDoc.title} — MoltenDocs`;

    // Double-click on links opens them in new tab
    docContent.addEventListener('dblclick', (e) => {
        const a = e.target.closest('a');
        if (a && a.href) { e.preventDefault(); window.open(a.href, '_blank'); }
    });

    // --- SELECTION MANAGEMENT ---
    function saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && docContent.contains(sel.anchorNode)) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    }
    function restoreSelection() {
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
            return true;
        }
        return false;
    }

    // Save selection on any format-bar mousedown (before focus shifts)
    document.querySelector('.format-bar')?.addEventListener('mousedown', (e) => {
        if (e.target.closest('#docContent')) return;
        saveSelection();
    }, true);

    // --- SAVE ---
    let saveTimer = null;
    function save() {
        currentDoc.content = docContent.innerHTML;
        currentDoc.date = new Date().toLocaleDateString();
        const idx = allDocs.findIndex(d => d.id === docId);
        if (idx !== -1) allDocs[idx] = currentDoc;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allDocs));
        if (saveStatus) { saveStatus.textContent = 'Saved'; saveStatus.classList.remove('saving'); }
    }
    function debouncedSave() {
        if (saveTimer) clearTimeout(saveTimer);
        if (saveStatus) { saveStatus.textContent = 'Saving...'; saveStatus.classList.add('saving'); }
        saveTimer = setTimeout(save, AUTOSAVE_DELAY);
    }

    // --- EXEC ---
    function exec(cmd, value = null) {
        docContent.focus();
        document.execCommand(cmd, false, value);
        debouncedSave();
        updateFormatState();
    }

    // --- BASIC FORMAT ---
    if (btnBold) btnBold.onclick = () => exec('bold');
    if (btnItalic) btnItalic.onclick = () => exec('italic');
    if (btnUnderline) btnUnderline.onclick = () => exec('underline');
    if (btnStrike) btnStrike.onclick = () => exec('strikeThrough');
    if (btnAlignL) btnAlignL.onclick = () => exec('justifyLeft');
    if (btnAlignC) btnAlignC.onclick = () => exec('justifyCenter');
    if (btnAlignR) btnAlignR.onclick = () => exec('justifyRight');
    if (btnAlignJ) btnAlignJ.onclick = () => exec('justifyFull');
    if (btnUL) btnUL.onclick = () => exec('insertUnorderedList');
    if (btnOL) btnOL.onclick = () => exec('insertOrderedList');
    if (btnHR) btnHR.onclick = () => exec('insertHorizontalRule');
    if (btnBlockquote) btnBlockquote.onclick = () => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const parent = getParentBlock(sel.anchorNode);
            exec('formatBlock', parent && parent.tagName === 'BLOCKQUOTE' ? 'p' : 'blockquote');
        }
    };
    if (btnUndo) btnUndo.onclick = () => exec('undo');
    if (btnRedo) btnRedo.onclick = () => exec('redo');
    if (fmtHeading) fmtHeading.onchange = () => exec('formatBlock', fmtHeading.value);

    if (fontFamily) {
        fontFamily.onchange = (e) => {
            if (restoreSelection()) exec('fontName', e.target.value);
        };
    }

    // --- TEXT COLOR ---
    if (fmtColor) fmtColor.oninput = () => { if (restoreSelection()) exec('foreColor', fmtColor.value); };

    // --- HIGHLIGHT ---
    if (highlightBtn) {
        highlightBtn.onclick = () => {
            if (!restoreSelection()) return;
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const node = sel.anchorNode?.parentElement;
                if (node && node.style?.backgroundColor && currentHighlightColor) {
                    const existing = rgbToHex(node.style.backgroundColor);
                    if (existing === currentHighlightColor.toLowerCase()) {
                        exec('removeFormat');
                        return;
                    }
                }
            }
            exec('hiliteColor', currentHighlightColor || '#ffff00');
        };
        highlightBtn.ondblclick = (e) => { e.preventDefault(); saveSelection(); highlightColorWheel?.click(); };
    }
    if (highlightColorWheel) {
        highlightColorWheel.oninput = (e) => {
            currentHighlightColor = e.target.value;
            highlightIndicator.style.background = e.target.value;
            if (restoreSelection()) exec('hiliteColor', e.target.value);
        };
    }
<<<<<<< HEAD

    // --- LINK ---
    if (btnLink) {
        btnLink.onclick = async () => {
            saveSelection();
            let url = await AppModal.prompt('Enter URL:');
            if (!url) return;
            if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:') && !url.startsWith('note:')) {
                url = 'https://' + url;
            }
            if (restoreSelection()) {
                document.execCommand('createLink', false, url);
                // Make links open in new tab
                const sel = window.getSelection();
                if (sel.anchorNode) {
                    const a = sel.anchorNode.parentElement.closest('a') || sel.anchorNode.parentElement;
                    if (a && a.tagName === 'A') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
                }
                debouncedSave();
            }
        };
    }
=======
>>>>>>> 1fd25a3d3770c0376e20448cbdcafd0540a99ea0

    // --- FILE MENU ---
    if (fileMenuBtn) fileMenuBtn.onclick = (e) => { e.stopPropagation(); closeAllDropdowns(); fileMenu.classList.toggle('hidden'); };

    // Export JSON
    if (btnExportJSON) btnExportJSON.onclick = () => {
        save();
        const data = { type: 'moltendocs', title: currentDoc.title, content: currentDoc.content, date: currentDoc.date, id: currentDoc.id };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${currentDoc.title.replace(/[^a-z0-9]/gi, '_')}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        fileMenu.classList.add('hidden');
    };

    // Import JSON (with cross-app detection)
    if (btnImportJSON) btnImportJSON.onclick = () => {
        jsonInput.click();
        fileMenu.classList.add('hidden');
    };
    if (jsonInput) jsonInput.onchange = async (e) => {
        if (!e.target.files.length) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!await AppModal.confirm('Importing a JSON file will overwrite your current document. Continue?', 'Import Notice')) return;
                const data = JSON.parse(e.target.result);

                // Cross-app detection: check if this is a MoltenSlides file
                if (data.pages && Array.isArray(data.pages)) {
                    if (await AppModal.confirm('This looks like a MoltenSlides presentation file. Did you mean to import it in MoltenSlides instead?', 'Import Notice')) {
                        // Import into MoltenSlides
                        let allSlides = [];
                        try { allSlides = JSON.parse(localStorage.getItem(SLIDES_KEY)) || []; } catch (err) { allSlides = []; }
                        data.id = Date.now();
                        data.title = (data.title || 'Imported') + ' (Imported)';
                        allSlides.push(data);
                        localStorage.setItem(SLIDES_KEY, JSON.stringify(allSlides));
                        window.location.href = `../MoltenSLIDES/Slides/index.html?id=${data.id}`;
                        return;
                    }
                    // User chose NO — don't import
                    jsonInput.value = '';
                    return;
                }

                // Valid MoltenDocs file
                if (data.content) {
                    currentDoc.content = data.content;
                    if (data.title) currentDoc.title = data.title;
                    docContent.innerHTML = currentDoc.content;
                    docTitle.textContent = currentDoc.title;
                    document.title = `${currentDoc.title} — MoltenDocs`;
                    save();
                    updateCounts();
                    showNotification('Document imported!');
                } else {
                    alert('Invalid document file. No content found.');
                }
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
        jsonInput.value = '';
    };



    // Print
    if (btnPrint) btnPrint.onclick = () => {
        save();
        fileMenu.classList.add('hidden');
        const printWin = window.open('', '_blank');
        printWin.document.write(`<!DOCTYPE html><html><head><title>${currentDoc.title}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:'Inter',sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#000;font-size:14px;line-height:1.7;}img{max-width:100%;height:auto;}@media print{body{padding:0;}}</style></head><body>${docContent.innerHTML}</body></html>`);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => printWin.print(), 500);
    };

    // --- HELP ---
    if (btnHelp) btnHelp.onclick = () => helpOverlay?.classList.toggle('hidden');

    // --- IMAGE ---
    if (btnImage) btnImage.onclick = () => { saveSelection(); imageInput.click(); };
    if (imageInput) imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            restoreSelection();
            const imgHTML = `<div class="doc-img-wrap" contenteditable="false" style="float:left;margin:0 16px 16px 0;width:300px;position:relative;cursor:move;"><img src="${ev.target.result}" alt="image" style="width:100%;height:auto;border-radius:4px;display:block;pointer-events:none;"><div class="img-resize-handle" style="position:absolute;bottom:-4px;right:-4px;width:12px;height:12px;background:var(--accent-orange,#ff5e3a);border-radius:2px;cursor:nwse-resize;"></div></div>`;
            exec('insertHTML', imgHTML);
        };
        reader.readAsDataURL(file);
        imageInput.value = '';
    };

    // Image click presets
    docContent.addEventListener('click', (e) => {
        const imgWrap = e.target.closest('.doc-img-wrap');
        if (!imgWrap) return;
        if (imgWrap.style.float === 'left') { imgWrap.style.float = 'right'; imgWrap.style.margin = '0 0 16px 16px'; }
        else if (imgWrap.style.float === 'right') { imgWrap.style.float = 'none'; imgWrap.style.margin = '16px auto'; }
        else { imgWrap.style.float = 'left'; imgWrap.style.margin = '0 16px 16px 0'; }
        debouncedSave();
    });

    // Image resize
    let resizeImg = null, resizeStartX, resizeStartW;
    docContent.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.img-resize-handle');
        if (handle) { e.preventDefault(); resizeImg = handle.closest('.doc-img-wrap'); resizeStartX = e.clientX; resizeStartW = resizeImg.offsetWidth; }
    });
    document.addEventListener('mousemove', (e) => { if (resizeImg) resizeImg.style.width = Math.max(100, resizeStartW + (e.clientX - resizeStartX)) + 'px'; });
    document.addEventListener('mouseup', () => { if (resizeImg) { resizeImg = null; debouncedSave(); } });

    // --- ZOOM ---
    function setZoom(level) {
        currentZoom = Math.max(0.5, Math.min(2, level));
        if (pageScaler) pageScaler.style.transform = `scale(${currentZoom})`;
        if (zoomLevel) zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
    }
    if (zoomIn) zoomIn.onclick = () => setZoom(currentZoom + 0.1);
    if (zoomOut) zoomOut.onclick = () => setZoom(currentZoom - 0.1);

    // --- TITLE ---
    if (docTitle) {
        docTitle.ondblclick = () => {
            const input = document.createElement('input');
            input.value = currentDoc.title;
            input.className = 'title-edit-input';
            docTitle.replaceWith(input);
            input.focus();
            input.select();
            const done = () => {
                const newTitle = input.value.trim() || 'Untitled';
                currentDoc.title = newTitle;
                docTitle.textContent = newTitle;
                document.title = `${newTitle} — MoltenDocs`;
                input.replaceWith(docTitle);
                save();
            };
            input.onblur = done;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); done(); }
                if (e.key === 'Escape') { docTitle.textContent = currentDoc.title; input.replaceWith(docTitle); }
            };
        };
    }

    // --- EVENTS ---
    docContent.addEventListener('input', () => { debouncedSave(); updateCounts(); });
    docContent.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
    });
    document.addEventListener('selectionchange', updateFormatState);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(currentZoom + 0.1); }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(currentZoom - 0.1); }
        if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(1); }
    });
    docContent.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b': e.preventDefault(); exec('bold'); break;
                case 'i': e.preventDefault(); exec('italic'); break;
                case 'u': e.preventDefault(); exec('underline'); break;
                case 'z': e.preventDefault(); exec(e.shiftKey ? 'redo' : 'undo'); break;
                case 'y': e.preventDefault(); exec('redo'); break;
                case 's': e.preventDefault(); save(); break;
                case 'p': e.preventDefault(); btnPrint?.click(); break;
            }
        }
    });

    // Paste
    docContent.addEventListener('paste', (e) => {
        const cd = e.clipboardData;
        if (cd && !cd.getData('text/html')) {
            e.preventDefault();
            exec('insertHTML', cd.getData('text/plain').replace(/\n/g, '<br>'));
        }
    });

    // --- FORMAT STATE ---
    function updateFormatState() {
        const toggle = (btn, cmd) => { if (btn) btn.classList.toggle('active', document.queryCommandState(cmd)); };
        toggle(btnBold, 'bold');
        toggle(btnItalic, 'italic');
        toggle(btnUnderline, 'underline');
        toggle(btnStrike, 'strikeThrough');
        toggle(btnUL, 'insertUnorderedList');
        toggle(btnOL, 'insertOrderedList');
        if (btnAlignL) btnAlignL.classList.toggle('active', document.queryCommandState('justifyLeft'));
        if (btnAlignC) btnAlignC.classList.toggle('active', document.queryCommandState('justifyCenter'));
        if (btnAlignR) btnAlignR.classList.toggle('active', document.queryCommandState('justifyRight'));
        if (btnAlignJ) btnAlignJ.classList.toggle('active', document.queryCommandState('justifyFull'));

        if (fmtHeading) {
            const block = document.queryCommandValue('formatBlock').replace(/<|>/g, '').toUpperCase();
            fmtHeading.value = ['H1', 'H2', 'H3'].includes(block) ? block : 'P';
        }

        const fontName = document.queryCommandValue('fontName');
        if (fontName && fontFamily) {
            const clean = fontName.replace(/"/g, '');
            const match = FONTS.find(f => f.value.includes(clean) || f.name.toLowerCase() === clean.toLowerCase());
            if (match) { fontFamily.value = match.value; }
        }

        if (fmtColor) {
            const c = document.queryCommandValue('foreColor');
            if (c) fmtColor.value = rgbToHex(c);
        }
    }

    // --- COUNTS ---
    function updateCounts() {
        const text = (docContent.innerText || '').trim();
        const words = text ? text.split(/\s+/).length : 0;
        if (wordCountEl) wordCountEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
        if (charCountEl) charCountEl.textContent = `${text.length} char${text.length !== 1 ? 's' : ''}`;
    }

    // --- HELPERS ---
    function rgbToHex(rgb) {
        if (!rgb || rgb.startsWith('#')) return rgb || '#000000';
        const m = rgb.match(/(\d+)/g);
        if (!m || m.length < 3) return '#000000';
        return '#' + m.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }
    function getParentBlock(node) {
        let el = node;
        while (el && el !== docContent) {
            if (el.nodeType === 1 && ['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI', 'DIV'].includes(el.tagName)) return el;
            el = el.parentNode;
        }
        return null;
    }
    function closeAllDropdowns() {
        fontPickerDropdown?.classList.add('hidden');
        highlightPalette?.classList.add('hidden');
        fileMenu?.classList.add('hidden');
    }
    function showNotification(msg) {
        const n = document.createElement('div');
        n.className = 'notification notification-success';
        n.innerHTML = `<span style="font-size:0.85rem;color:white;">${msg}</span>`;
        document.body.appendChild(n);
        requestAnimationFrame(() => n.classList.add('show'));
        setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2500);
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.font-picker-wrap')) fontPickerDropdown?.classList.add('hidden');
        if (!e.target.closest('.highlight-wrap')) highlightPalette?.classList.add('hidden');
        if (!e.target.closest('.dropdown-wrap')) fileMenu?.classList.add('hidden');
    });

    // --- INIT ---
    updateCounts();
    updateFormatState();
    docContent.focus();
    window.addEventListener('beforeunload', save);
});
