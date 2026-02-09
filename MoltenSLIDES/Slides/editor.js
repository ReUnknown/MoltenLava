document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CONFIG & STATE ---
    const STORAGE_KEY = 'moltenSlides_beta';
    const urlParams = new URLSearchParams(window.location.search);
    const deckId = urlParams.get('id');

    let allDecks = [];
    let currentDeck = null;
    let activePageIndex = 0;
    let activeTool = 'select';
    let currentScale = 1;
    let selectedId = null; 
    let editingId = null;

    // Undo/Redo
    let history = [];
    let historyIndex = -1;
    const MAX_HISTORY = 50;

    let currentTextStyle = {
        fontFamily: 'Inter, sans-serif', 
        color: '#000000',
        fontWeight: 'normal', 
        fontStyle: 'normal', 
        textDecoration: 'none',
        fontSize: 40,
        textAlign: 'left'
    };

    let currentShapeStyle = {
        fill: '#3b82f6',
        stroke: '#000000',
        strokeWidth: 2
    };

    // Save timeout for debouncing
    let saveTimeout = null;

    // Feature flags - disable if libraries fail to load
    let features = {
        pptxExport: typeof PptxGenJS !== 'undefined',
        pdfExport: typeof window.jspdf !== 'undefined' && typeof html2canvas !== 'undefined',
        contextMenu: true,
        animations: true
    };

    // --- 2. LOAD DATA ---
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if(raw) allDecks = JSON.parse(raw);
    } catch(e) { 
        console.error('Error loading data:', e); 
    }

    currentDeck = allDecks.find(d => d.id == deckId);
    if (!currentDeck) {
        const errorModal = document.getElementById('errorModal');
        const overlay = document.getElementById('modalOverlay');
        if(errorModal && overlay) {
            errorModal.classList.remove('hidden');
            overlay.classList.remove('hidden');
        }
        return;
    }

    // UI References
    const titleElement = document.getElementById('editorTitle');
    const slideStrip = document.getElementById('slideStrip');
    const mainCanvas = document.querySelector('.slide-canvas');
    const bottomBar = document.getElementById('bottomBar');
    const imgInput = document.getElementById('imgUpload');
    const presentBtn = document.getElementById('presentBtn');
    const saveStatus = document.getElementById('saveStatus');
    const contextMenu = document.getElementById('contextMenu');

    // Hidden Input for Import
    const jsonInput = document.createElement('input');
    jsonInput.type = 'file'; 
    jsonInput.accept = '.json'; 
    jsonInput.style.display = 'none';
    document.body.appendChild(jsonInput);

    if(titleElement) titleElement.innerText = currentDeck.title;

    // --- 3. FILE MENU ---
    function setupFileMenu() {
        try {
            const btnExportJSON = document.getElementById('btnExportJSON');
            const btnExportPPTX = document.getElementById('btnExportPPTX');
            const btnExportPDF = document.getElementById('btnExportPDF');
            const btnDeleteDeck = document.getElementById('btnDeleteDeck');
            const btnImport = document.getElementById('btnImport');

            if (btnExportJSON) btnExportJSON.onclick = exportJSON;
            if (btnDeleteDeck) btnDeleteDeck.onclick = deleteDeck;
            if (btnImport) btnImport.onclick = () => jsonInput.click();

            // Only enable PPTX if library loaded
            if (btnExportPPTX) {
                if (features.pptxExport) {
                    btnExportPPTX.onclick = exportPPTX;
                } else {
                    btnExportPPTX.style.opacity = '0.5';
                    btnExportPPTX.style.cursor = 'not-allowed';
                    btnExportPPTX.onclick = () => alert('PowerPoint export unavailable. Library failed to load.');
                }
            }

            // Only enable PDF if libraries loaded
            if (btnExportPDF) {
                if (features.pdfExport) {
                    btnExportPDF.onclick = exportPDF;
                } else {
                    btnExportPDF.style.opacity = '0.5';
                    btnExportPDF.style.cursor = 'not-allowed';
                    btnExportPDF.onclick = () => alert('PDF export unavailable. Required libraries failed to load.');
                }
            }
        } catch(e) {
            console.error('Error setting up file menu:', e);
        }
    }
    setupFileMenu();
    pushHistory(); 

    // --- 4. EXPORT LOGIC ---
    function exportJSON() {
        try {
            const dataStr = JSON.stringify(currentDeck, null, 2);
            const blob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentDeck.title.replace(/\s+/g, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch(e) {
            console.error('Export JSON failed:', e);
            alert('Failed to export project. Error: ' + e.message);
        }
    }

    async function exportPPTX() {
        if (!features.pptxExport) {
            alert('PowerPoint export is unavailable. The PptxGenJS library failed to load. Please refresh the page and try again.');
            return;
        }

        try {
            showLoading('Generating PowerPoint...');
            
            const pptx = new PptxGenJS();
            pptx.layout = 'LAYOUT_16x9';

            for (let i = 0; i < currentDeck.pages.length; i++) {
                const page = currentDeck.pages[i];
                const slide = pptx.addSlide();

                // Set background if exists
                if (page.background) {
                    try {
                        slide.background = { color: page.background.replace('#', '') };
                    } catch(e) {
                        console.warn('Failed to set background for slide', i, e);
                    }
                }

                page.elements.forEach(el => {
                    try {
                        const x = (el.x || 0) / 1280 * 10;
                        const y = (el.y || 0) / 720 * 5.625;
                        const w = (el.width || 300) / 1280 * 10;
                        const h = (el.height || 300) / 720 * 5.625;

                        if (el.type === 'text' || el.type === 'title') {
                            slide.addText(el.text || '', {
                                x: x,
                                y: y,
                                w: w,
                                h: h,
                                fontSize: (el.fontSize || 40) * 0.75,
                                fontFace: el.fontFamily?.split(',')[0].replace(/'/g, '') || 'Arial',
                                color: el.color?.replace('#', '') || '000000',
                                bold: el.fontWeight === 'bold',
                                italic: el.fontStyle === 'italic',
                                underline: { style: el.textDecoration === 'underline' ? 'sng' : 'none' },
                                align: el.textAlign || 'left',
                                valign: 'top'
                            });
                        } else if (el.type === 'image' && el.src) {
                            slide.addImage({
                                data: el.src,
                                x: x,
                                y: y,
                                w: w,
                                h: h
                            });
                        } else if (el.type === 'rect') {
                            slide.addShape(pptx.ShapeType.rect, {
                                x: x, y: y, w: w, h: h,
                                fill: { color: el.fill?.replace('#', '') || '3b82f6' },
                                line: { 
                                    color: el.stroke?.replace('#', '') || '000000',
                                    width: (el.strokeWidth || 2) / 10
                                }
                            });
                        } else if (el.type === 'circle') {
                            slide.addShape(pptx.ShapeType.ellipse, {
                                x: x, y: y, w: w, h: h,
                                fill: { color: el.fill?.replace('#', '') || '3b82f6' },
                                line: { 
                                    color: el.stroke?.replace('#', '') || '000000',
                                    width: (el.strokeWidth || 2) / 10
                                }
                            });
                        }
                    } catch(e) {
                        console.warn('Failed to add element to slide', i, el, e);
                    }
                });
            }

            await pptx.writeFile({ fileName: `${currentDeck.title}.pptx` });
            hideLoading();
        } catch(e) {
            console.error('PPTX export failed:', e);
            hideLoading();
            alert('Failed to export PowerPoint. Error: ' + e.message);
        }
    }

    async function exportPDF() {
        if (!features.pdfExport) {
            alert('PDF export is unavailable. Required libraries (jsPDF and html2canvas) failed to load. Please refresh the page and try again.');
            return;
        }

        try {
            showLoading('Generating PDF...');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [1280, 720]
            });

            const originalIndex = activePageIndex;
            const wasEditing = editingId;
            
            deselect();

            for (let i = 0; i < currentDeck.pages.length; i++) {
                try {
                    if (i > 0) pdf.addPage();
                    
                    activePageIndex = i;
                    renderMain();
                    
                    await new Promise(resolve => setTimeout(resolve, 200));

                    const slideContent = document.getElementById('mainSlideContent');
                    if (!slideContent) {
                        console.warn('Slide content not found for slide', i);
                        continue;
                    }

                    const canvas = await html2canvas(slideContent, {
                        scale: 2,
                        backgroundColor: '#ffffff',
                        logging: false,
                        width: 1280,
                        height: 720
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 0, 0, 1280, 720);
                } catch(e) {
                    console.error('Failed to render slide', i, e);
                    // Add a blank page with error message
                    pdf.setFontSize(20);
                    pdf.text(`Slide ${i + 1} - Rendering Error`, 640, 360, { align: 'center' });
                }
            }

            activePageIndex = originalIndex;
            if (wasEditing) editingId = wasEditing;
            renderMain();

            pdf.save(`${currentDeck.title.replace(/\s+/g, '_')}.pdf`);
            hideLoading();
        } catch(e) {
            console.error('PDF export failed:', e);
            hideLoading();
            alert('Failed to export PDF. Error: ' + e.message);
        }
    }

    function deleteDeck() {
        try {
            if(confirm("Are you sure you want to delete this deck? This cannot be undone.")) {
                allDecks = allDecks.filter(d => d.id != deckId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(allDecks));
                window.location.href = '../index.html';
            }
        } catch(e) {
            console.error('Delete deck failed:', e);
            alert('Failed to delete deck. Error: ' + e.message);
        }
    }

    jsonInput.onchange = (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if(data.pages && Array.isArray(data.pages)) {
                        data.id = Date.now();
                        data.title = (data.title || "Untitled") + " (Imported)";
                        allDecks.push(data);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(allDecks));
                        window.location.href = `?id=${data.id}`;
                    } else { 
                        alert("Invalid Project File - missing pages array"); 
                    }
                } catch(err) { 
                    console.error('Import error:', err);
                    alert("Error reading file: " + err.message); 
                }
            };
            reader.onerror = () => {
                alert('Failed to read file. Please try again.');
            };
            reader.readAsText(e.target.files[0]);
        }
        e.target.value = '';
    };

    // --- 5. RENDER ENGINE ---
    function generateSlideHTML(page, isThumb = false, isPresenting = false) {
        if (!page || !page.elements) return '';
        
        let html = '';
        
        try {
            // Apply page background
            if (page.background && !isThumb) {
                const slideContent = document.getElementById('mainSlideContent');
                if (slideContent) {
                    slideContent.style.background = page.background;
                }
            }
            
            page.elements.forEach((el, index) => {
                try {
                    const w = el.width ? `width:${el.width}px;` : (el.type==='image'?'width:300px;':'width:auto;');
                    const h = el.height ? `height:${el.height}px;` : (el.type==='image'?'height:300px;':'height:auto;');
                    const z = isThumb ? '' : `z-index:${index};`;
                    const rot = el.rotation ? `transform: rotate(${el.rotation}deg);` : '';
                    
                    let classes = 'slide-element';
                    if (!isThumb) {
                        if (el.id === editingId) classes += ' editing';
                        else if (el.id === selectedId) classes += ' selected';
                    }
                    
                    // Add animation class in presentation mode
                    if (isPresenting && el.animation && el.animation !== 'none' && features.animations) {
                        classes += ` anim-${el.animation}`;
                    }

                    const style = `
                        left: ${el.x || 0}px; 
                        top: ${el.y || 0}px; 
                        ${w} ${h} ${z} ${rot}
                        font-family: ${el.fontFamily || 'Inter, sans-serif'};
                        font-weight: ${el.fontWeight || 'normal'};
                        font-style: ${el.fontStyle || 'normal'};
                        text-decoration: ${el.textDecoration || 'none'};
                        color: ${el.color || 'black'};
                        font-size: ${el.fontSize || 40}px;
                        text-align: ${el.textAlign || 'left'};
                    `.trim();

                    let inner = '';
                    if (el.type === 'text' || el.type === 'title') {
                        const isEd = (!isThumb && el.id === editingId);
                        const text = el.text || 'Type here';
                        inner = `<div class="element-text" contenteditable="${isEd}">${text}</div>`;
                    } else if (el.type === 'image') {
                        inner = `<img class="element-image" src="${el.src || ''}" alt="slide image" onerror="this.style.display='none'">`;
                    } else if (el.type === 'rect') {
                        inner = `<div class="element-shape" style="width:100%; height:100%; background:${el.fill || '#3b82f6'}; border: ${el.strokeWidth || 2}px solid ${el.stroke || '#000000'};"></div>`;
                    } else if (el.type === 'circle') {
                        inner = `<div class="element-shape" style="width:100%; height:100%; background:${el.fill || '#3b82f6'}; border: ${el.strokeWidth || 2}px solid ${el.stroke || '#000000'}; border-radius: 50%;"></div>`;
                    } else if (el.type === 'line') {
                        inner = `<div class="element-shape" style="width:100%; height:${el.strokeWidth || 2}px; background:${el.stroke || '#000000'};"></div>`;
                    }

                    html += `<div class="${classes}" id="${isThumb ? 'thumb_'+el.id : el.id}" data-id="${el.id}" style="${style}">
                        ${inner}
                        ${!isThumb && el.id === selectedId && el.id !== editingId ? getHandles() : ''}
                    </div>`;
                } catch(e) {
                    console.error('Error rendering element:', el, e);
                }
            });
        } catch(e) {
            console.error('Error generating slide HTML:', e);
        }
        
        return html;
    }

    function getHandles() {
        return `
            <div class="resize-handle handle-nw" data-dir="nw"></div>
            <div class="resize-handle handle-ne" data-dir="ne"></div>
            <div class="resize-handle handle-se" data-dir="se"></div>
            <div class="resize-handle handle-sw" data-dir="sw"></div>
            <div class="rotate-line"></div>
            <div class="rotate-handle" data-dir="rotate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                </svg>
            </div>
        `;
    }

    function render() {
        try {
            renderSidebar();
            renderMain();
        } catch(e) {
            console.error('Error rendering:', e);
        }
    }

    function renderSidebar() {
        if (!slideStrip) return;
        
        try {
            slideStrip.innerHTML = "";
            currentDeck.pages.forEach((page, index) => {
                try {
                    const wrap = document.createElement('div');
                    wrap.className = 'slide-wrapper';
                    wrap.style.position = 'relative';

                    const menuHTML = `
                        <div class="slide-controls">
                            <button class="slide-control-btn" data-action="moveUp" data-index="${index}" title="Move Up">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                                </svg>
                            </button>
                            <button class="slide-control-btn" data-action="moveDown" data-index="${index}" title="Move Down">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
                                </svg>
                            </button>
                            <button class="slide-control-btn" data-action="duplicate" data-index="${index}" title="Duplicate Slide">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                            </button>
                            <button class="slide-control-btn delete" data-action="delete" data-index="${index}" title="Delete Slide">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                            </button>
                        </div>
                    `;

                    // Background color indicator
                    const bgStyle = page.background ? `background: ${page.background};` : '';
                    
                    wrap.innerHTML = `
                        <div class="slide-num">${index + 1}</div>
                        <div class="slide-thumbnail ${index === activePageIndex ? 'active' : ''}">
                            ${menuHTML}
                            <div class="thumb-scaler" style="transform: scale(0.17); ${bgStyle}">
                                ${generateSlideHTML(page, true)}
                            </div>
                        </div>
                    `;
                    
                    wrap.querySelectorAll('[data-action]').forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const action = btn.dataset.action;
                            const idx = parseInt(btn.dataset.index);
                            
                            try {
                                if (action === 'moveUp') moveSlidePage(idx, -1);
                                else if (action === 'moveDown') moveSlidePage(idx, 1);
                                else if (action === 'delete') deleteSlidePage(idx);
                                else if (action === 'duplicate') duplicateSlidePage(idx);
                            } catch(e) {
                                console.error('Error performing slide action:', action, e);
                            }
                        };
                    });

                    wrap.querySelector('.slide-thumbnail').onclick = (e) => { 
                        if(e.target.closest('button')) return;
                        activePageIndex = index; 
                        deselect(); 
                        render(); 
                    };
                    slideStrip.appendChild(wrap);
                } catch(e) {
                    console.error('Error rendering slide thumbnail:', index, e);
                }
            });
            
            // Add new slide button
            const btn = document.createElement('div');
            btn.className = 'tool-btn';
            btn.innerHTML = '+';
            btn.style.cssText = "width:100%; border:1px dashed #333; margin-top:10px; cursor:pointer; display:grid; place-items:center;";
            btn.onclick = addNewPage;
            slideStrip.appendChild(btn);
        } catch(e) {
            console.error('Error rendering sidebar:', e);
        }
    }

    function renderMain() {
        if (!mainCanvas || !currentDeck.pages[activePageIndex]) return;
        
        try {
            const page = currentDeck.pages[activePageIndex];
            const isPresenting = document.body.classList.contains('presenting');
            
            mainCanvas.innerHTML = `
                <div class="slide-content editor-scaler" id="mainSlideContent" style="background: ${page.background || 'white'};">
                    ${generateSlideHTML(page, false, isPresenting)}
                </div>
            `;
            fitCanvas();
            attachEvents();
            updateUI();
        } catch(e) {
            console.error('Error rendering main canvas:', e);
        }
    }

    // --- 6. HISTORY & PERSISTENCE ---
    function pushHistory() {
        const state = JSON.stringify(currentDeck);
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(state); 
        if (history.length > MAX_HISTORY) {
            history.shift();
        } else {
            historyIndex++;
        }
        debouncedSave();
    }

    function undo() { 
        if(historyIndex > 0) { 
            historyIndex--; 
            currentDeck = JSON.parse(history[historyIndex]); 
            if(activePageIndex >= currentDeck.pages.length) {
                activePageIndex = currentDeck.pages.length - 1;
            }
            deselect();
            render(); 
            save(); 
        }
    }

    function redo() { 
        if(historyIndex < history.length - 1) { 
            historyIndex++; 
            currentDeck = JSON.parse(history[historyIndex]); 
            deselect();
            render(); 
            save(); 
        }
    }

    function debouncedSave() {
        clearTimeout(saveTimeout);
        if (saveStatus) {
            saveStatus.textContent = 'Saving...';
            saveStatus.classList.add('saving');
        }
        saveTimeout = setTimeout(() => {
            save();
            if (saveStatus) {
                saveStatus.textContent = 'Saved';
                saveStatus.classList.remove('saving');
            }
        }, 1000);
    }

    function save() { 
        const i = allDecks.findIndex(d => d.id == currentDeck.id); 
        if(i !== -1) { 
            allDecks[i] = currentDeck; 
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(allDecks)); 
            } catch(e) {
                console.error('Save failed:', e);
                if (saveStatus) {
                    saveStatus.textContent = 'Save Failed!';
                    saveStatus.style.color = '#ef4444';
                }
                // Check if storage is full
                if (e.name === 'QuotaExceededError') {
                    alert('Storage is full! Please export your project or delete some slides.');
                } else {
                    alert('Failed to save. Error: ' + e.message);
                }
            }
        } 
    }

    // --- 7. SLIDE MANAGEMENT ---
    function moveSlidePage(index, dir) {
        try {
            if ((dir === -1 && index > 0) || (dir === 1 && index < currentDeck.pages.length - 1)) {
                const temp = currentDeck.pages[index];
                currentDeck.pages[index] = currentDeck.pages[index + dir];
                currentDeck.pages[index + dir] = temp;
                activePageIndex = index + dir; 
                pushHistory(); 
                render();
            }
        } catch(e) {
            console.error('Error moving slide:', e);
        }
    }

    function deleteSlidePage(index) {
        try {
            if (currentDeck.pages.length <= 1) {
                alert("Cannot delete the last slide");
                return;
            }
            if (!confirm(`Delete slide ${index + 1}?`)) return;
            
            currentDeck.pages.splice(index, 1);
            if (activePageIndex >= currentDeck.pages.length) {
                activePageIndex = currentDeck.pages.length - 1;
            }
            pushHistory(); 
            render();
        } catch(e) {
            console.error('Error deleting slide:', e);
            alert('Failed to delete slide. Error: ' + e.message);
        }
    }

    function duplicateSlidePage(index) {
        try {
            const page = currentDeck.pages[index];
            const clone = JSON.parse(JSON.stringify(page));
            clone.id = 'p' + Date.now();
            clone.elements.forEach(el => {
                el.id = 'el' + Date.now() + Math.random().toString(36).substr(2, 9);
            });
            currentDeck.pages.splice(index + 1, 0, clone);
            activePageIndex = index + 1;
            pushHistory();
            render();
        } catch(e) {
            console.error('Error duplicating slide:', e);
            alert('Failed to duplicate slide. Error: ' + e.message);
        }
    }

    function addNewPage() {
        try {
            currentDeck.pages.push({
                id: 'p' + Date.now(), 
                background: '#ffffff',
                elements: [{
                    id: 't' + Date.now(), 
                    type: 'title', 
                    text: 'Title', 
                    x: 100, 
                    y: 100, 
                    fontSize: 60, 
                    width: 600, 
                    fontFamily: 'Inter, sans-serif', 
                    fontWeight: 'bold', 
                    color: '#000',
                    textAlign: 'left'
                }]
            }); 
            pushHistory(); 
            activePageIndex = currentDeck.pages.length - 1; 
            render();
        } catch(e) {
            console.error('Error adding new page:', e);
            alert('Failed to add new slide. Error: ' + e.message);
        }
    }

    // --- 8. EVENT HANDLING ---
    function attachEvents() {
        const content = document.getElementById('mainSlideContent');
        if (!content) return;

        try {
            content.onmousedown = (e) => {
                if (e.target === content) { 
                    if(activeTool === 'text') createText(e); 
                    else deselect(); 
                }
            };

            currentDeck.pages[activePageIndex].elements.forEach(el => {
                const dom = document.getElementById(el.id);
                if(!dom) return;

                try {
                    // Right-click context menu
                    if (features.contextMenu) {
                        dom.oncontextmenu = (e) => {
                            e.preventDefault();
                            if (selectedId !== el.id) select(el.id);
                            showContextMenu(e.clientX, e.clientY);
                        };
                    }

                    if(el.type !== 'image' && el.type !== 'rect' && el.type !== 'circle' && el.type !== 'line') {
                        dom.ondblclick = (e) => { 
                            e.stopPropagation(); 
                            enterEditMode(el.id); 
                        };
                    }

                    dom.onmousedown = (e) => {
                        // Don't intercept text selection when editing
                        if (editingId === el.id && e.target.classList.contains('element-text')) {
                            return;
                        }
                        
                        if (activeTool !== 'select' || editingId === el.id) return;
                        e.stopPropagation();

                        const handle = e.target.closest('[data-dir]');
                        if(handle) { 
                            e.preventDefault(); 
                            if(handle.dataset.dir === 'rotate') {
                                startRotate(e, dom, el);
                            } else {
                                startResize(e, dom, el, handle.dataset.dir);
                            }
                            return; 
                        }

                        if(selectedId !== el.id) select(el.id); 
                        initDrag(e, dom, el);
                    };
                } catch(e) {
                    console.error('Error attaching events to element:', el, e);
                }
            });
        } catch(e) {
            console.error('Error in attachEvents:', e);
        }
    }

    function handleKeydown(e) {
        if (editingId && e.target.contentEditable === 'true') {
            return;
        }

        if((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { 
            e.preventDefault(); 
            undo(); 
        }
        if((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { 
            e.preventDefault(); 
            redo(); 
        }
        if((e.ctrlKey || e.metaKey) && e.key === 'd') { 
            e.preventDefault(); 
            duplicateElement(); 
        }
        if((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) { 
            e.preventDefault(); 
            deleteSelected(); 
        }
        if(e.key === 'Escape' && editingId) {
            e.preventDefault();
            saveEditing();
        }
    }

    function handleGlobalClick(e) { 
        if(editingId) { 
            const dom = document.getElementById(editingId); 
            if(dom && !dom.contains(e.target) && !e.target.closest('#bottomBar')) {
                saveEditing(); 
            }
        }
        
        // Hide context menu
        if (contextMenu && !e.target.closest('#contextMenu')) {
            contextMenu.classList.remove('visible');
        }
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousedown', handleGlobalClick);

    // --- 9. SELECTION & EDITING ---
    function select(id) { 
        selectedId = id; 
        renderMain(); 
    }

    function deselect() { 
        if(selectedId || editingId) { 
            saveEditing(); 
            selectedId = null; 
            editingId = null; 
            renderMain(); 
        } 
    }

    function deleteSelected() { 
        if (!selectedId) return;
        const p = currentDeck.pages[activePageIndex]; 
        p.elements = p.elements.filter(el => el.id !== selectedId); 
        selectedId = null; 
        pushHistory(); 
        renderMain(); 
        renderSidebar(); 
    }

    function duplicateElement() {
        if (!selectedId) return;
        const el = currentDeck.pages[activePageIndex].elements.find(e => e.id === selectedId);
        if (!el) return;
        
        const clone = JSON.parse(JSON.stringify(el));
        clone.id = 'el' + Date.now();
        clone.x += 20;
        clone.y += 20;
        
        currentDeck.pages[activePageIndex].elements.push(clone);
        pushHistory();
        render();
        select(clone.id);
    }

    function enterEditMode(id) { 
        if(editingId === id) return; 
        saveEditing(); 
        editingId = id; 
        selectedId = id; 
        renderMain(); 
        const d = document.getElementById(id); 
        if (!d) return;
        const i = d.querySelector('.element-text'); 
        if (i) {
            i.focus(); 
            const range = document.createRange();
            range.selectNodeContents(i);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        updateUI(); 
    }

    function saveEditing() { 
        if(!editingId) return; 
        const d = document.getElementById(editingId); 
        if (!d) {
            editingId = null;
            return;
        }
        const i = d.querySelector('.element-text'); 
        const el = currentDeck.pages[activePageIndex].elements.find(e => e.id === editingId); 
        if(el && i) {
            el.text = i.innerText || 'Type here';
        }
        editingId = null; 
        pushHistory(); 
        renderMain(); 
        renderSidebar(); 
    }

    // --- 10. ELEMENT CREATION ---
    function createText(e) {
        try {
            const r = document.getElementById('mainSlideContent').getBoundingClientRect(); 
            const x = (e.clientX - r.left) / currentScale; 
            const y = (e.clientY - r.top) / currentScale; 
            const n = {
                id: 'el' + Date.now(), 
                type: 'text', 
                text: 'Type here', 
                x: x, 
                y: y, 
                fontSize: 40, 
                width: 250, 
                height: 'auto', 
                ...currentTextStyle
            }; 
            currentDeck.pages[activePageIndex].elements.push(n); 
            pushHistory(); 
            renderMain(); 
            select(n.id); 
            setActiveTool('select'); 
            setTimeout(() => enterEditMode(n.id), 50);
        } catch(e) {
            console.error('Error creating text:', e);
        }
    }

    function createShape(type) {
        try {
            const shape = {
                id: 'shape' + Date.now(),
                type: type,
                x: 200,
                y: 200,
                width: type === 'line' ? 300 : 200,
                height: type === 'line' ? 4 : 200,
                ...currentShapeStyle
            };
            currentDeck.pages[activePageIndex].elements.push(shape);
            pushHistory();
            render();
            select(shape.id);
        } catch(e) {
            console.error('Error creating shape:', e);
            alert('Failed to create shape. Error: ' + e.message);
        }
    }

    // --- 11. DRAG & RESIZE ---
    function snapToGrid(value, gridSize = 10) {
        return Math.round(value / gridSize) * gridSize;
    }

    function initDrag(e, dom, data) { 
        const sX = e.clientX;
        const sY = e.clientY;
        const iX = data.x;
        const iY = data.y; 
        let frameId = null; 
        
        const mv = (ev) => { 
            if(frameId) cancelAnimationFrame(frameId); 
            frameId = requestAnimationFrame(() => { 
                const dx = (ev.clientX - sX) / currentScale;
                const dy = (ev.clientY - sY) / currentScale; 
                const newX = snapToGrid(iX + dx);
                const newY = snapToGrid(iY + dy);
                dom.style.left = newX + 'px'; 
                dom.style.top = newY + 'px'; 
                data.x = newX; 
                data.y = newY; 
            }); 
        }; 
        
        const up = () => { 
            if(frameId) cancelAnimationFrame(frameId); 
            window.removeEventListener('mousemove', mv); 
            window.removeEventListener('mouseup', up); 
            pushHistory(); 
            renderSidebar(); 
        }; 
        
        window.addEventListener('mousemove', mv); 
        window.addEventListener('mouseup', up); 
    }

    function startResize(e, dom, data, dir) { 
        e.preventDefault(); 
        e.stopPropagation(); 
        
        const sX = e.clientX;
        const sY = e.clientY;
        const sW = dom.offsetWidth;
        const sH = dom.offsetHeight;
        const sL = data.x;
        const sT = data.y;
        const r = sW / sH; 
        let frameId = null; 
        
        const mv = (ev) => { 
            if(frameId) cancelAnimationFrame(frameId); 
            frameId = requestAnimationFrame(() => { 
                const dx = (ev.clientX - sX) / currentScale;
                const dy = (ev.clientY - sY) / currentScale; 
                let nW = sW;
                let nH = sH;
                let nL = sL;
                let nT = sT; 
                
                if(dir.includes('e')) nW = sW + dx; 
                if(dir.includes('s')) nH = sH + dy; 
                if(dir.includes('w')) { 
                    nW = sW - dx; 
                    nL = sL + dx; 
                } 
                if(dir.includes('n')) { 
                    nH = sH - dy; 
                    nT = sT + dy; 
                } 
                
                const lock = (data.type === 'image' || data.type === 'circle') ? !ev.shiftKey : ev.shiftKey; 
                if(lock) { 
                    if(dir.includes('e') || dir.includes('w')) { 
                        nH = nW / r; 
                        if(dir.includes('n')) nT = sT + (sH - nH); 
                    } else { 
                        nW = nH * r; 
                        if(dir.includes('w')) nL = sL + (sW - nW); 
                    } 
                } 
                
                nW = Math.max(20, nW);
                nH = Math.max(20, nH);
                
                dom.style.width = nW + 'px'; 
                dom.style.height = nH + 'px'; 
                dom.style.left = nL + 'px'; 
                dom.style.top = nT + 'px'; 
                data.width = nW; 
                data.height = nH; 
                data.x = nL; 
                data.y = nT; 
            }); 
        }; 
        
        const up = () => { 
            if(frameId) cancelAnimationFrame(frameId); 
            window.removeEventListener('mousemove', mv); 
            window.removeEventListener('mouseup', up); 
            pushHistory(); 
            renderSidebar(); 
        }; 
        
        window.addEventListener('mousemove', mv); 
        window.addEventListener('mouseup', up); 
    }

    function startRotate(e, dom, data) { 
        e.preventDefault(); 
        e.stopPropagation(); 
        
        const r = dom.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2; 
        let frameId = null; 
        
        const mv = (ev) => { 
            if(frameId) cancelAnimationFrame(frameId); 
            frameId = requestAnimationFrame(() => { 
                const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
                const deg = (angle * (180 / Math.PI) + 90) % 360; 
                dom.style.transform = `rotate(${deg}deg)`; 
                data.rotation = deg; 
            }); 
        }; 
        
        const up = () => { 
            if(frameId) cancelAnimationFrame(frameId); 
            window.removeEventListener('mousemove', mv); 
            window.removeEventListener('mouseup', up); 
            pushHistory(); 
            renderSidebar(); 
        }; 
        
        window.addEventListener('mousemove', mv); 
        window.addEventListener('mouseup', up); 
    }

    // --- 12. FORMATTING UI ---
    function updateUI() {
        if (!bottomBar) return;
        
        if (!selectedId) { 
            bottomBar.classList.add('hidden'); 
            return; 
        }
        
        bottomBar.classList.remove('hidden');
        const el = currentDeck.pages[activePageIndex].elements.find(e => e.id === selectedId);
        if (!el) return;
        
        let html = '';
        
        if(el.type === 'text' || el.type === 'title') {
            html += `
                <select id="fontFamily" class="font-select">
                    <option value="Inter, sans-serif" style="font-family: Inter;">Inter</option>
                    <option value="Arial, sans-serif" style="font-family: Arial;">Arial</option>
                    <option value="'Courier New', monospace" style="font-family: 'Courier New';">Courier New</option>
                    <option value="Georgia, serif" style="font-family: Georgia;">Georgia</option>
                    <option value="Impact, sans-serif" style="font-family: Impact;">Impact</option>
                    <option value="'Times New Roman', serif" style="font-family: 'Times New Roman';">Times New Roman</option>
                    <option value="Verdana, sans-serif" style="font-family: Verdana;">Verdana</option>
                </select>
                <input type="number" id="fontSize" class="font-size-input" min="8" max="200" value="${el.fontSize || 40}">
                <div class="toolbar-divider"></div>
                <button class="format-btn ${el.fontWeight === 'bold' ? 'active' : ''}" id="btnBold" title="Bold"><strong>B</strong></button>
                <button class="format-btn ${el.fontStyle === 'italic' ? 'active' : ''}" id="btnItalic" title="Italic"><em>I</em></button>
                <button class="format-btn ${el.textDecoration === 'underline' ? 'active' : ''}" id="btnUnderline" title="Underline"><u>U</u></button>
                <div class="toolbar-divider"></div>
                <button class="format-btn ${el.textAlign === 'left' ? 'active' : ''}" id="btnAlignLeft" title="Align Left">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/>
                    </svg>
                </button>
                <button class="format-btn ${el.textAlign === 'center' ? 'active' : ''}" id="btnAlignCenter" title="Align Center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v2H3V3zm3 4h12v2H6V7zm-3 4h18v2H3v-2zm3 4h12v2H6v-2zm-3 4h18v2H3v-2z"/>
                    </svg>
                </button>
                <button class="format-btn ${el.textAlign === 'right' ? 'active' : ''}" id="btnAlignRight" title="Align Right">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v2H3V3zm6 4h12v2H9V7zm-6 4h18v2H3v-2zm6 4h12v2H9v-2zm-6 4h18v2H3v-2z"/>
                    </svg>
                </button>
                <div class="toolbar-divider"></div>
                <div class="color-wrapper">
                    <input type="color" id="textColor" class="color-input" value="${el.color || '#000000'}">
                </div>
                <div class="toolbar-divider"></div>
            `;
        } else if (el.type === 'rect' || el.type === 'circle' || el.type === 'line') {
            html += `
                <div class="color-wrapper" title="Fill Color">
                    <input type="color" id="fillColor" class="color-input" value="${el.fill || '#3b82f6'}">
                </div>
                <div class="color-wrapper" title="Border Color">
                    <input type="color" id="strokeColor" class="color-input" value="${el.stroke || '#000000'}">
                </div>
                <input type="number" id="strokeWidth" class="font-size-input" min="0" max="20" value="${el.strokeWidth || 2}" title="Border Width">
                <div class="toolbar-divider"></div>
            `;
        }
        
        html += `
            <button class="format-btn" id="btnLayerBack" title="Send Backward">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 16l-6-6 1.41-1.41L12 13.17l4.59-4.58L18 10z"/>
                </svg>
            </button>
            <button class="format-btn" id="btnLayerFront" title="Bring Forward">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>
                </svg>
            </button>
        `;
        
        bottomBar.innerHTML = html;

        // Attach event listeners
        if(el.type === 'text' || el.type === 'title') {
            const fontSel = document.getElementById('fontFamily');
            if (fontSel) {
                fontSel.value = el.fontFamily || 'Inter, sans-serif';
                fontSel.onchange = (e) => setProp('fontFamily', e.target.value);
            }
            
            const fontSizeInput = document.getElementById('fontSize');
            if (fontSizeInput) {
                fontSizeInput.oninput = (e) => setProp('fontSize', parseInt(e.target.value) || 40);
            }
            
            const colorInput = document.getElementById('textColor');
            if (colorInput) {
                colorInput.oninput = (e) => setProp('color', e.target.value);
            }
            
            const btnBold = document.getElementById('btnBold');
            if (btnBold) btnBold.onclick = () => togProp('fontWeight', 'bold', 'normal');
            
            const btnItalic = document.getElementById('btnItalic');
            if (btnItalic) btnItalic.onclick = () => togProp('fontStyle', 'italic', 'normal');
            
            const btnUnderline = document.getElementById('btnUnderline');
            if (btnUnderline) btnUnderline.onclick = () => togProp('textDecoration', 'underline', 'none');
            
            const btnAlignLeft = document.getElementById('btnAlignLeft');
            if (btnAlignLeft) btnAlignLeft.onclick = () => setProp('textAlign', 'left');
            
            const btnAlignCenter = document.getElementById('btnAlignCenter');
            if (btnAlignCenter) btnAlignCenter.onclick = () => setProp('textAlign', 'center');
            
            const btnAlignRight = document.getElementById('btnAlignRight');
            if (btnAlignRight) btnAlignRight.onclick = () => setProp('textAlign', 'right');
        } else if (el.type === 'rect' || el.type === 'circle' || el.type === 'line') {
            const fillColor = document.getElementById('fillColor');
            if (fillColor) {
                fillColor.oninput = (e) => setProp('fill', e.target.value);
            }
            
            const strokeColor = document.getElementById('strokeColor');
            if (strokeColor) {
                strokeColor.oninput = (e) => setProp('stroke', e.target.value);
            }
            
            const strokeWidth = document.getElementById('strokeWidth');
            if (strokeWidth) {
                strokeWidth.oninput = (e) => setProp('strokeWidth', parseInt(e.target.value) || 2);
            }
        }

        const btnFront = document.getElementById('btnLayerFront');
        const btnBack = document.getElementById('btnLayerBack');
        if (btnFront) btnFront.onclick = () => moveLayer(1);
        if (btnBack) btnBack.onclick = () => moveLayer(-1);
    }

    function moveLayer(dir) {
        if (!selectedId) return;
        const els = currentDeck.pages[activePageIndex].elements;
        const idx = els.findIndex(e => e.id === selectedId);
        if (idx === -1) return;
        
        if ((dir === 1 && idx < els.length - 1) || (dir === -1 && idx > 0)) {
            const temp = els[idx];
            els[idx] = els[idx + dir];
            els[idx + dir] = temp;
            pushHistory(); 
            renderMain();
        }
    }

    const setProp = (k, v) => { 
        if(selectedId) { 
            const el = currentDeck.pages[activePageIndex].elements.find(e => e.id === selectedId); 
            if (el) {
                el[k] = v; 
                pushHistory(); 
                renderMain(); 
                renderSidebar();
                updateUI(); 
            }
        } 
    };

    const togProp = (k, a, b) => { 
        if(selectedId) { 
            const el = currentDeck.pages[activePageIndex].elements.find(e => e.id === selectedId); 
            if (el) {
                el[k] = (el[k] === a) ? b : a; 
                pushHistory(); 
                renderMain(); 
                renderSidebar();
                updateUI(); 
            }
        } 
    };

    // --- 13. CONTEXT MENU ---
    function showContextMenu(x, y) {
        if (!contextMenu || !features.contextMenu) return;
        try {
            contextMenu.style.left = x + 'px';
            contextMenu.style.top = y + 'px';
            contextMenu.classList.add('visible');
        } catch(e) {
            console.error('Error showing context menu:', e);
        }
    }

    // Context menu actions
    try {
        const ctxDuplicate = document.getElementById('ctxDuplicate');
        if (ctxDuplicate) {
            ctxDuplicate.addEventListener('click', () => {
                try {
                    duplicateElement();
                    contextMenu.classList.remove('visible');
                } catch(e) {
                    console.error('Error duplicating element:', e);
                }
            });
        }

        const ctxLayerFront = document.getElementById('ctxLayerFront');
        if (ctxLayerFront) {
            ctxLayerFront.addEventListener('click', () => {
                try {
                    moveLayer(1);
                    contextMenu.classList.remove('visible');
                } catch(e) {
                    console.error('Error moving layer:', e);
                }
            });
        }

        const ctxLayerBack = document.getElementById('ctxLayerBack');
        if (ctxLayerBack) {
            ctxLayerBack.addEventListener('click', () => {
                try {
                    moveLayer(-1);
                    contextMenu.classList.remove('visible');
                } catch(e) {
                    console.error('Error moving layer:', e);
                }
            });
        }

        const ctxDelete = document.getElementById('ctxDelete');
        if (ctxDelete) {
            ctxDelete.addEventListener('click', () => {
                try {
                    deleteSelected();
                    contextMenu.classList.remove('visible');
                } catch(e) {
                    console.error('Error deleting element:', e);
                }
            });
        }

        // Animation submenu
        document.querySelectorAll('[data-animation]').forEach(item => {
            item.addEventListener('click', () => {
                try {
                    const animation = item.dataset.animation;
                    if (selectedId) {
                        const el = currentDeck.pages[activePageIndex].elements.find(e => e.id === selectedId);
                        if (el) {
                            el.animation = animation;
                            pushHistory();
                            renderSidebar();
                        }
                    }
                    contextMenu.classList.remove('visible');
                } catch(e) {
                    console.error('Error setting animation:', e);
                }
            });
        });
    } catch(e) {
        console.error('Error setting up context menu:', e);
        features.contextMenu = false;
    }

    // --- 14. CANVAS SCALING ---
    function fitCanvas() { 
        if(document.body.classList.contains('presenting')) return; 
        
        const c = document.getElementById('mainSlideContent'); 
        const a = document.querySelector('.canvas-area'); 
        if(!c || !a) return; 
        
        const scaleX = (a.clientWidth - 40) / 1280;
        const scaleY = (a.clientHeight - 40) / 720;
        currentScale = Math.min(scaleX, scaleY); 
        c.style.transform = `scale(${currentScale})`; 
    }
    
    window.addEventListener('resize', fitCanvas);

    // --- 15. PRESENTATION MODE ---
    if (presentBtn) {
        presentBtn.onclick = () => { 
            document.body.classList.add('presenting'); 
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log('Fullscreen failed:', err);
                });
            }
            deselect(); 
            document.addEventListener('keydown', handlePresentNav); 
            
            const s = document.querySelector('.editor-shell'); 
            if (s) {
                s.style.justifyContent = 'center'; 
                s.style.alignItems = 'center'; 
            }
            
            renderMain();
            
            const c = document.getElementById('mainSlideContent'); 
            if (c) {
                c.style.position = 'static'; 
                c.style.margin = 'auto'; 
                const sw = window.innerWidth / 1280; 
                const sh = window.innerHeight / 720; 
                c.style.transform = `scale(${Math.min(sw, sh)})`; 
            }
        };
    }

    function handlePresentNav(e) { 
        if(e.key === 'ArrowRight' || e.key === ' ') { 
            e.preventDefault();
            if(activePageIndex < currentDeck.pages.length - 1) {
                activePageIndex++; 
                renderMain(); 
                refreshFullScale();
            }
        } else if(e.key === 'ArrowLeft') { 
            e.preventDefault();
            if(activePageIndex > 0) {
                activePageIndex--; 
                renderMain(); 
                refreshFullScale();
            }
        } else if(e.key === 'Escape') {
            e.preventDefault();
            exitPresentation(); 
        }
    }

    function exitPresentation() { 
        if(document.fullscreenElement) {
            document.exitFullscreen();
        }
        document.body.classList.remove('presenting'); 
        document.removeEventListener('keydown', handlePresentNav); 
        
        const s = document.querySelector('.editor-shell'); 
        if (s) {
            s.style.justifyContent = ''; 
            s.style.alignItems = ''; 
        }
        
        const c = document.getElementById('mainSlideContent'); 
        if (c) {
            c.style.position = 'relative'; 
            c.style.margin = ''; 
        }
        
        fitCanvas(); 
    }

    function refreshFullScale() { 
        const c = document.getElementById('mainSlideContent'); 
        if (!c) return;
        const sw = window.innerWidth / 1280; 
        const sh = window.innerHeight / 720; 
        c.style.transform = `scale(${Math.min(sw, sh)})`; 
    }

    document.addEventListener('fullscreenchange', () => { 
        if(!document.fullscreenElement) exitPresentation(); 
    });

    // --- 16. TOOLBAR TOOLS ---
    const selectTool = document.getElementById('selectTool');
    const textTool = document.getElementById('textTool');
    const imageTool = document.getElementById('imageTool');

    if (selectTool) selectTool.onclick = () => setActiveTool('select', selectTool);
    if (textTool) textTool.onclick = () => setActiveTool('text', textTool);
    if (imageTool) imageTool.onclick = () => imgInput.click();

    // Shape tools
    document.getElementById('shapeRect')?.addEventListener('click', () => createShape('rect'));
    document.getElementById('shapeCircle')?.addEventListener('click', () => createShape('circle'));
    document.getElementById('shapeLine')?.addEventListener('click', () => createShape('line'));

    function setActiveTool(t, b) { 
        activeTool = t; 
        document.querySelectorAll('.tool-btn').forEach(x => x.classList.remove('active')); 
        
        if(b) {
            b.classList.add('active');
        } else if(t === 'select') {
            const selectBtn = document.getElementById('selectTool');
            if (selectBtn) selectBtn.classList.add('active');
        }
        
        const content = document.getElementById('mainSlideContent');
        if (content) {
            content.style.cursor = t === 'text' ? 'text' : 'default'; 
        }
        
        if(t === 'text') deselect(); 
    }

    // --- 17. IMAGE UPLOAD ---
    if (imgInput) {
        imgInput.onchange = (e) => { 
            if(e.target.files[0]) {
                // Validate size
                if (e.target.files[0].size > 5 * 1024 * 1024) {
                    alert('Image too large (max 5MB)');
                    e.target.value = '';
                    return;
                }
                
                const r = new FileReader(); 
                r.onload = (ev) => { 
                    const n = {
                        id: 'img' + Date.now(), 
                        type: 'image', 
                        src: ev.target.result, 
                        x: 100, 
                        y: 100, 
                        width: 400, 
                        height: 300
                    }; 
                    currentDeck.pages[activePageIndex].elements.push(n); 
                    pushHistory(); 
                    render(); 
                    select(n.id); 
                }; 
                r.readAsDataURL(e.target.files[0]); 
            }
            e.target.value = '';
        };
    }

    // --- 18. TITLE EDITING ---
    if (titleElement) {
        titleElement.ondblclick = () => { 
            const i = document.createElement('input'); 
            i.value = currentDeck.title; 
            i.style.cssText = "background:#222; border:1px solid #444; color:white; font-size:1rem; padding:4px; border-radius:4px;"; 
            titleElement.replaceWith(i); 
            i.focus(); 
            i.select();
            
            const s = () => {
                currentDeck.title = i.value || "Untitled"; 
                save(); 
                titleElement.innerText = currentDeck.title; 
                i.replaceWith(titleElement);
            }; 
            
            i.onblur = s; 
            i.onkeydown = (e) => {
                if(e.key === 'Enter') {
                    e.preventDefault();
                    s();
                } else if(e.key === 'Escape') {
                    titleElement.innerText = currentDeck.title;
                    i.replaceWith(titleElement);
                }
            }; 
        };
    }

    // --- 19. HELP MODAL ---
    const btnHelp = document.getElementById('btnHelp');
    const helpModal = document.getElementById('helpModal');
    const closeHelp = document.getElementById('closeHelp');
    const modalOverlay = document.getElementById('modalOverlay');

    if (btnHelp && helpModal && modalOverlay) {
        btnHelp.onclick = () => {
            helpModal.classList.remove('hidden');
            modalOverlay.classList.remove('hidden');
        };
    }

    if (closeHelp && helpModal && modalOverlay) {
        closeHelp.onclick = () => {
            helpModal.classList.add('hidden');
            modalOverlay.classList.add('hidden');
        };
    }

    // --- 20. LOADING STATE ---
    function showLoading(message = 'Loading...') {
        try {
            const loader = document.createElement('div');
            loader.id = 'loadingOverlay';
            loader.className = 'loading-overlay';
            loader.innerHTML = `
                <div style="text-align: center;">
                    <div class="loading-spinner"></div>
                    <div style="color: white; margin-top: 1rem; font-size: 0.9rem;">${message}</div>
                </div>
            `;
            document.body.appendChild(loader);
        } catch(e) {
            console.error('Error showing loading overlay:', e);
        }
    }

    function hideLoading() {
        try {
            const loader = document.getElementById('loadingOverlay');
            if (loader) loader.remove();
        } catch(e) {
            console.error('Error hiding loading overlay:', e);
        }
    }

    // --- 21. INITIAL RENDER ---
    try {
        render();
    } catch(e) {
        console.error('Error in initial render:', e);
        alert('An error occurred while loading the editor. Please refresh the page.');
    }
});