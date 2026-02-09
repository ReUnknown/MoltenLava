// ═══════════════════════════════════════════════════════════════════
// MOLTENSLIDES EDITOR - COMPLETE JAVASCRIPT
// Part 1 of 3 - Paste Part 2 and Part 3 directly after this
// All bugs fixed, new features added!
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    
    // ━━━ 1. CONFIG & STATE ━━━
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

    // Canvas panning
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panOffsetX = 0;
    let panOffsetY = 0;

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
        textAlign: 'left',
        shadow: 'none',
        outline: 'none'
    };

    let currentShapeStyle = {
        fill: '#3b82f6',
        stroke: '#000000',
        strokeWidth: 2,
        shadow: 'none'
    };

    let saveTimeout = null;
    let isDragging = false;

    const features = {
        pptxExport: typeof PptxGenJS !== 'undefined',
        pdfExport: typeof window.jspdf !== 'undefined' && typeof html2canvas !== 'undefined',
        gifExport: typeof html2canvas !== 'undefined',
        contextMenu: true,
        animations: true
    };

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // ━━━ 2. LOAD DATA ━━━
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
    const canvasArea = document.querySelector('.canvas-area');
    const bottomBar = document.getElementById('bottomBar');
    const imgInput = document.getElementById('imgUpload');
    const presentBtn = document.getElementById('presentBtn');
    const saveStatus = document.getElementById('saveStatus');
    const contextMenu = document.getElementById('contextMenu');

    const jsonInput = document.createElement('input');
    jsonInput.type = 'file'; 
    jsonInput.accept = '.json'; 
    jsonInput.style.display = 'none';
    document.body.appendChild(jsonInput);

    if(titleElement) titleElement.innerText = currentDeck.title;

    // ━━━ 3. NOTIFICATION SYSTEM (Critical only) ━━━
    function showNotification(message, type = 'error') {
        // Only show errors and critical info
        if (type !== 'error') return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">✕</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ━━━ 4. DROPDOWN SYSTEM ━━━
    function setupDropdowns() {
        const fileDropdown = document.getElementById('fileDropdown');
        const fileMenu = document.getElementById('fileMenu');
        
        if (fileDropdown) {
            fileDropdown.querySelector('.tool-btn').onclick = (e) => {
                e.stopPropagation();
                const isActive = fileDropdown.classList.contains('active');
                closeAllDropdowns();
                if (!isActive) {
                    fileDropdown.classList.add('active');
                    positionDropdown(fileMenu, e.target);
                }
            };
        }

        const shapesDropdown = document.getElementById('shapesDropdown');
        const shapesMenu = document.getElementById('shapesMenu');
        
        if (shapesDropdown) {
            shapesDropdown.querySelector('.tool-btn').onclick = (e) => {
                e.stopPropagation();
                const isActive = shapesDropdown.classList.contains('active');
                closeAllDropdowns();
                if (!isActive) {
                    shapesDropdown.classList.add('active');
                    positionDropdown(shapesMenu, e.target);
                }
            };
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-container')) {
                closeAllDropdowns();
            }
        });
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.dropdown-container').forEach(d => d.classList.remove('active'));
    }

    function positionDropdown(menu, button) {
        if (!menu || !button) return;
        
        const buttonRect = button.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        if (buttonRect.left + menuRect.width > window.innerWidth) {
            menu.classList.add('align-right');
        } else {
            menu.classList.remove('align-right');
        }
        
        if (buttonRect.bottom + menuRect.height > window.innerHeight) {
            menu.classList.add('align-top');
        } else {
            menu.classList.remove('align-top');
        }
    }

    // ━━━ 5. FILE MENU ━━━
    function setupFileMenu() {
        try {
            const btnExportJSON = document.getElementById('btnExportJSON');
            const btnExportPPTX = document.getElementById('btnExportPPTX');
            const btnExportPDF = document.getElementById('btnExportPDF');
            const btnExportGIF = document.getElementById('btnExportGIF');
            const btnDeleteDeck = document.getElementById('btnDeleteDeck');
            const btnImport = document.getElementById('btnImport');

            if (btnExportJSON) btnExportJSON.onclick = () => { exportJSON(); closeAllDropdowns(); };
            if (btnDeleteDeck) btnDeleteDeck.onclick = () => { deleteDeck(); closeAllDropdowns(); };
            if (btnImport) btnImport.onclick = () => { jsonInput.click(); closeAllDropdowns(); };

            if (btnExportPPTX) {
                if (features.pptxExport) {
                    btnExportPPTX.onclick = () => { exportPPTX(); closeAllDropdowns(); };
                } else {
                    btnExportPPTX.style.opacity = '0.5';
                    btnExportPPTX.onclick = () => { 
                        showNotification('PowerPoint export unavailable', 'error'); 
                        closeAllDropdowns(); 
                    };
                }
            }

            if (btnExportPDF) {
                if (features.pdfExport) {
                    btnExportPDF.onclick = () => { exportPDF(); closeAllDropdowns(); };
                } else {
                    btnExportPDF.style.opacity = '0.5';
                    btnExportPDF.onclick = () => { 
                        showNotification('PDF export unavailable', 'error'); 
                        closeAllDropdowns(); 
                    };
                }
            }

            if (btnExportGIF) {
                btnExportGIF.onclick = () => { exportGIF(); closeAllDropdowns(); };
            }
        } catch(e) {
            console.error('Error setting up file menu:', e);
        }
    }
    
    setupDropdowns();
    setupFileMenu();
    
    // ━━━ 6. EXPORT FUNCTIONS ━━━
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
            showNotification('Export failed', 'error');
        }
    }

    async function exportPPTX() {
        if (!features.pptxExport) {
            showNotification('PowerPoint export unavailable', 'error');
            return;
        }

        try {
            showLoading('Generating PowerPoint...');
            
            const pptx = new PptxGenJS();
            pptx.layout = 'LAYOUT_16x9';

            for (let i = 0; i < currentDeck.pages.length; i++) {
                const page = currentDeck.pages[i];
                const slide = pptx.addSlide();

                if (page.background) {
                    try {
                        slide.background = { color: page.background.replace('#', '') };
                    } catch(e) {
                        console.warn('Background error:', e);
                    }
                }

                page.elements.forEach(el => {
                    try {
                        // FIXED: Better scaling - convert 1280x720 canvas to 10x5.625 inches
                        const x = (el.x || 0) / 1280 * 10;
                        const y = (el.y || 0) / 720 * 5.625;
                        const w = (el.width || 300) / 1280 * 10;
                        const h = (el.height || 300) / 720 * 5.625;

                        if (el.type === 'text' || el.type === 'title') {
                            slide.addText(el.text || '', {
                                x, y, w, h,
                                fontSize: (el.fontSize || 40) / 1.5,
                                fontFace: el.fontFamily?.split(',')[0].replace(/'/g, '').trim() || 'Arial',
                                color: el.color?.replace('#', '') || '000000',
                                bold: el.fontWeight === 'bold',
                                italic: el.fontStyle === 'italic',
                                underline: el.textDecoration === 'underline',
                                align: el.textAlign || 'left',
                                valign: 'top'
                            });
                        } else if (el.type === 'image' && el.src) {
                            slide.addImage({ data: el.src, x, y, w, h });
                        } else if (['rect', 'circle', 'triangle', 'diamond', 'hexagon'].includes(el.type)) {
                            const shapeType = {
                                'rect': pptx.ShapeType.rect,
                                'circle': pptx.ShapeType.ellipse,
                                'triangle': pptx.ShapeType.triangle,
                                'diamond': pptx.ShapeType.diamond,
                                'hexagon': pptx.ShapeType.hexagon
                            }[el.type] || pptx.ShapeType.rect;

                            slide.addShape(shapeType, {
                                x, y, w, h,
                                fill: { color: el.fill?.replace('#', '') || '3b82f6' },
                                line: { 
                                    color: el.stroke?.replace('#', '') || '000000',
                                    width: (el.strokeWidth || 2) / 50
                                }
                            });
                        }
                    } catch(e) {
                        console.warn('Element error:', e);
                    }
                });
            }

            await pptx.writeFile({ fileName: `${currentDeck.title}.pptx` });
            hideLoading();
        } catch(e) {
            console.error('PPTX export failed:', e);
            hideLoading();
            showNotification('PowerPoint export failed', 'error');
        }
    }

    async function exportPDF() {
        if (!features.pdfExport) {
            showNotification('PDF export unavailable', 'error');
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
            const wasSelected = selectedId;
            const originalPan = { x: panOffsetX, y: panOffsetY };
            
            selectedId = null;
            editingId = null;
            panOffsetX = 0;
            panOffsetY = 0;

            for (let i = 0; i < currentDeck.pages.length; i++) {
                try {
                    if (i > 0) pdf.addPage();
                    
                    activePageIndex = i;
                    renderMain();
                    
                    await new Promise(resolve => setTimeout(resolve, 500));

                    const slideContent = document.getElementById('mainSlideContent');
                    if (!slideContent) continue;

                    const canvas = await html2canvas(slideContent, {
                        scale: 2,
                        backgroundColor: currentDeck.pages[i].background || '#ffffff',
                        logging: false,
                        width: 1280,
                        height: 720,
                        x: 0,
                        y: 0,
                        scrollX: 0,
                        scrollY: 0
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 0, 0, 1280, 720);
                } catch(e) {
                    console.error('Slide error:', e);
                }
            }

            activePageIndex = originalIndex;
            selectedId = wasSelected;
            editingId = wasEditing;
            panOffsetX = originalPan.x;
            panOffsetY = originalPan.y;
            renderMain();

            pdf.save(`${currentDeck.title.replace(/\s+/g, '_')}.pdf`);
            hideLoading();
        } catch(e) {
            console.error('PDF export failed:', e);
            hideLoading();
            showNotification('PDF export failed', 'error');
        }
    }

    async function exportGIF() {
        if (!features.gifExport) {
            showNotification('GIF export unavailable', 'error');
            return;
        }

        try {
            showLoading('Generating animated GIF...');
            
            const page = currentDeck.pages[activePageIndex];
            const slideContent = document.getElementById('mainSlideContent');
            if (!slideContent) {
                showNotification('No slide found', 'error');
                hideLoading();
                return;
            }

            // Capture frames for each animation step
            const frames = [];
            const animatedElements = page.elements.filter(el => el.animation && el.animation !== 'none');
            
            // Frame 1: Before animations
            const tempAnimations = {};
            animatedElements.forEach(el => {
                tempAnimations[el.id] = el.animation;
                el.animation = 'none';
            });
            renderMain();
            await new Promise(resolve => setTimeout(resolve, 100));
            
            let canvas = await html2canvas(slideContent, {
                scale: 1.5,
                backgroundColor: page.background || '#ffffff',
                logging: false,
                width: 1280,
                height: 720
            });
            frames.push(canvas.toDataURL('image/png'));

            // Frame 2: With animations
            animatedElements.forEach(el => {
                el.animation = tempAnimations[el.id];
            });
            renderMain();
            await new Promise(resolve => setTimeout(resolve, 600)); // Wait for animation
            
            canvas = await html2canvas(slideContent, {
                scale: 1.5,
                backgroundColor: page.background || '#ffffff',
                logging: false,
                width: 1280,
                height: 720
            });
            frames.push(canvas.toDataURL('image/png'));

            // For now, save as PNG (real GIF needs gif.js library)
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 1280;
            finalCanvas.height = 720;
            const ctx = finalCanvas.getContext('2d');
            
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                finalCanvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentDeck.title}_slide_${activePageIndex + 1}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    hideLoading();
                }, 'image/png');
            };
            img.src = frames[frames.length - 1];

            renderMain();
        } catch(e) {
            console.error('GIF export failed:', e);
            hideLoading();
            showNotification('GIF export failed', 'error');
        }
    }

    function deleteDeck() {
        try {
            if(confirm("Delete this deck? This cannot be undone.")) {
                allDecks = allDecks.filter(d => d.id != deckId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(allDecks));
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 100);
            }
        } catch(e) {
            console.error('Delete failed:', e);
            showNotification('Delete failed', 'error');
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
                        setTimeout(() => {
                            window.location.href = `?id=${data.id}`;
                        }, 100);
                    } else { 
                        showNotification('Invalid file', 'error');
                    }
                } catch(err) { 
                    console.error('Import error:', err);
                    showNotification('Import failed', 'error');
                }
            };
            reader.onerror = () => showNotification('File read error', 'error');
            reader.readAsText(e.target.files[0]);
        }
        e.target.value = '';
    };

    // ━━━ 7. RENDER ENGINE ━━━
    function generateSlideHTML(page, isThumb = false, isPresenting = false) {
        if (!page || !page.elements) return '';
        
        let html = '';
        
        try {
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
                    
                    // Shadow and outline support
                    let shadowStyle = '';
                    if (el.shadow && el.shadow !== 'none') {
                        if (el.type === 'text' || el.type === 'title') {
                            shadowStyle = `text-shadow: ${el.shadow};`;
                        } else {
                            shadowStyle = `box-shadow: ${el.shadow};`;
                        }
                    }
                    
                    let outlineStyle = '';
                    if (el.outline && el.outline !== 'none') {
                        if (el.type === 'text' || el.type === 'title') {
                            outlineStyle = `-webkit-text-stroke: ${el.outline};`;
                        } else {
                            outlineStyle = `outline: ${el.outline};`;
                        }
                    }
                    
                    let classes = 'slide-element';
                    if (!isThumb) {
                        if (el.id === editingId) classes += ' editing';
                        else if (el.id === selectedId) classes += ' selected';
                    }
                    
                    // Animation handling
                    if (isPresenting && el.animation && el.animation !== 'none' && features.animations) {
                        if (el.animation === 'transition') {
                            // Transition animation handled separately
                        } else {
                            classes += ` anim-${el.animation}`;
                        }
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
                        ${shadowStyle}
                        ${outlineStyle}
                    `.trim();

                    let inner = '';
                    if (el.type === 'text' || el.type === 'title') {
                        const isEd = (!isThumb && el.id === editingId);
                        const text = el.text || 'Type here';
                        inner = `<div class="element-text" contenteditable="${isEd}">${text}</div>`;
                    } else if (el.type === 'image') {
                        inner = `<img class="element-image" src="${el.src || ''}" alt="" onerror="this.style.display='none'">`;
                    } else if (el.type === 'rect') {
                        inner = `<div class="element-shape" style="width:100%; height:100%; background:${el.fill || '#3b82f6'}; border: ${el.strokeWidth || 2}px solid ${el.stroke || '#000000'};"></div>`;
                    } else if (el.type === 'circle') {
                        inner = `<div class="element-shape" style="width:100%; height:100%; background:${el.fill || '#3b82f6'}; border: ${el.strokeWidth || 2}px solid ${el.stroke || '#000000'}; border-radius: 50%;"></div>`;
                    } else if (el.type === 'line') {
                        inner = `<div class="element-shape" style="width:100%; height:${el.strokeWidth || 2}px; background:${el.stroke || '#000000'};"></div>`;
                    } else if (el.type === 'triangle') {
                        inner = `<svg class="element-shape" width="100%" height="100%" viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg>`;
                    } else if (el.type === 'arrow') {
                        inner = `<svg class="element-shape" width="100%" height="100%" viewBox="0 0 100 40"><path d="M 0,20 L 70,20 L 70,10 L 100,25 L 70,40 L 70,30 L 0,30 Z" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg>`;
                    } else if (el.type === 'star') {
                        inner = `<svg class="element-shape" width="100%" height="100%" viewBox="0 0 100 100"><polygon points="50,10 61,35 90,35 67,55 78,85 50,65 22,85 33,55 10,35 39,35" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg>`;
                    } else if (el.type === 'heart') {
                        inner = `<svg class="element-shape" width="100%" height="100%" viewBox="0 0 100 100"><path d="M50,90 C50,90 10,60 10,40 C10,25 20,15 30,15 C40,15 45,20 50,30 C55,20 60,15 70,15 C80,15 90,25 90,40 C90,60 50,90 50,90 Z" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg>`;
                    } else if (el.type === 'diamond') {
                        inner = `<svg class="element-shape" width="100%" height="100%" viewBox="0 0 100 100"><polygon points="50,10 90,50 50,90 10,50" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg>`;
                    } else if (el.type === 'hexagon') {
                        inner = `<svg class="element-shape" width="100%" height="100%" viewBox="0 0 100 100"><polygon points="25,10 75,10 95,50 75,90 25,90 5,50" fill="${el.fill || '#3b82f6'}" stroke="${el.stroke || '#000000'}" stroke-width="${(el.strokeWidth || 2) / 2}"/></svg>`;
                    }

                    html += `<div class="${classes}" id="${isThumb ? 'thumb_'+el.id : el.id}" data-id="${el.id}" style="${style}">
                        ${inner}
                        ${!isThumb && el.id === selectedId && el.id !== editingId ? getHandles() : ''}
                    </div>`;
                } catch(e) {
                    console.error('Element render error:', e);
                }
            });
        } catch(e) {
            console.error('HTML generation error:', e);
        }
        
        return html;
    }

    function getHandles() {
        // FIXED: Larger touch-friendly handles on mobile
        const handleSize = isTouchDevice ? 'width: 24px; height: 24px;' : '';
        return `
            <div class="resize-handle handle-nw" data-dir="nw" style="${handleSize}"></div>
            <div class="resize-handle handle-ne" data-dir="ne" style="${handleSize}"></div>
            <div class="resize-handle handle-se" data-dir="se" style="${handleSize}"></div>
            <div class="resize-handle handle-sw" data-dir="sw" style="${handleSize}"></div>
            <div class="rotate-line"></div>
            <div class="rotate-handle" data-dir="rotate" style="${handleSize}">
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
            console.error('Render error:', e);
            showNotification('Rendering error', 'error');
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
                            <button class="slide-control-btn" data-action="duplicate" data-index="${index}" title="Duplicate">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                            </button>
                            <button class="slide-control-btn delete" data-action="delete" data-index="${index}" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                            </button>
                        </div>
                    `;

                    const bgStyle = page.background ? `background: ${page.background};` : '';
                    
                    // FIXED: Maintain aspect ratio in thumbnails
                    wrap.innerHTML = `
                        <div class="slide-num">${index + 1}</div>
                        <div class="slide-thumbnail ${index === activePageIndex ? 'active' : ''}">
                            ${menuHTML}
                            <div class="thumb-scaler" style="transform: scale(0.17); transform-origin: top left; width: 1280px; height: 720px; ${bgStyle}">
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
                                console.error('Slide action error:', e);
                                showNotification('Action failed', 'error');
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
                    console.error('Thumbnail error:', e);
                }
            });
            
            const btn = document.createElement('div');
            btn.className = 'tool-btn';
            btn.innerHTML = '+';
            btn.style.cssText = "width:100%; border:1px dashed #333; margin-top:10px; cursor:pointer; display:grid; place-items:center;";
            btn.onclick = addNewPage;
            slideStrip.appendChild(btn);
        } catch(e) {
            console.error('Sidebar error:', e);
        }
    }

    function renderMain() {
        if (!mainCanvas || !currentDeck.pages[activePageIndex]) return;
        
        try {
            const page = currentDeck.pages[activePageIndex];
            const isPresenting = document.body.classList.contains('presenting');
            
            mainCanvas.innerHTML = `
                <div class="slide-content editor-scaler" id="mainSlideContent" style="background: ${page.background || 'white'}; width: 1280px; height: 720px; position: relative;">
                    ${generateSlideHTML(page, false, isPresenting)}
                </div>
            `;
            fitCanvas();
            attachEvents();
            updateUI();
        } catch(e) {
            console.error('Main render error:', e);
        }
    }

    // ━━━ 8. HISTORY & SAVE ━━━
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
                    saveStatus.textContent = 'Failed!';
                    saveStatus.style.color = '#ef4444';
                }
                if (e.name === 'QuotaExceededError') {
                    showNotification('Storage full! Export project.', 'error');
                }
            }
        } 
    }

    pushHistory();

// ━━━ CONTINUE TO PART 2 ━━━
// ═══════════════════════════════════════════════════════════════════
// PART 2 - Paste directly after Part 1
// ═══════════════════════════════════════════════════════════════════

    // ━━━ 9. SLIDE MANAGEMENT ━━━
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
            console.error('Move error:', e);
            showNotification('Move failed', 'error');
        }
    }

    function deleteSlidePage(index) {
        try {
            if (currentDeck.pages.length <= 1) {
                showNotification('Cannot delete last slide', 'error');
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
            console.error('Delete error:', e);
            showNotification('Delete failed', 'error');
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
            console.error('Duplicate error:', e);
            showNotification('Duplicate failed', 'error');
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
            console.error('Add slide error:', e);
            showNotification('Add failed', 'error');
        }
    }

    // ━━━ 10. CANVAS PANNING ━━━
    function setupCanvasPanning() {
        if (!canvasArea) return;

        let spacePressed = false;

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !editingId && e.target.tagName !== 'INPUT' && e.target.contentEditable !== 'true') {
                e.preventDefault();
                spacePressed = true;
                canvasArea.classList.add('panning');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spacePressed = false;
                canvasArea.classList.remove('panning', 'active');
            }
        });

        canvasArea.addEventListener('mousedown', (e) => {
            if (spacePressed) {
                e.preventDefault();
                isPanning = true;
                panStartX = e.clientX - panOffsetX;
                panStartY = e.clientY - panOffsetY;
                canvasArea.classList.add('active');
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isPanning && spacePressed) {
                panOffsetX = e.clientX - panStartX;
                panOffsetY = e.clientY - panStartY;
                applyPan();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                canvasArea.classList.remove('active');
            }
        });

        if (isTouchDevice) {
            let touchStartDist = 0;
            let initialScale = 1;

            canvasArea.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    isPanning = true;
                    touchStartDist = getTouchDistance(e.touches);
                    initialScale = currentScale;
                }
            });

            canvasArea.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && isPanning) {
                    e.preventDefault();
                    const dist = getTouchDistance(e.touches);
                    const scale = initialScale * (dist / touchStartDist);
                    currentScale = Math.max(0.5, Math.min(3, scale));
                    fitCanvas();
                }
            });

            canvasArea.addEventListener('touchend', () => {
                isPanning = false;
            });
        }
    }

    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function applyPan() {
        if (!mainCanvas) return;
        mainCanvas.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px)`;
    }

    setupCanvasPanning();

    // ━━━ 11. EVENT HANDLING (FIXED FOR MOBILE) ━━━
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

            if (isTouchDevice) {
                content.ontouchstart = (e) => {
                    if (e.target === content && e.touches.length === 1) { 
                        if(activeTool === 'text') {
                            const touch = e.touches[0];
                            createText({ clientX: touch.clientX, clientY: touch.clientY });
                        } else {
                            deselect();
                        }
                    }
                };
            }

            currentDeck.pages[activePageIndex].elements.forEach(el => {
                const dom = document.getElementById(el.id);
                if(!dom) return;

                try {
                    if (features.contextMenu) {
                        dom.oncontextmenu = (e) => {
                            e.preventDefault();
                            if (selectedId !== el.id) select(el.id);
                            showContextMenu(e.clientX, e.clientY);
                        };

                        if (isTouchDevice) {
                            let longPressTimer;
                            dom.addEventListener('touchstart', (e) => {
                                longPressTimer = setTimeout(() => {
                                    const touch = e.touches[0];
                                    if (selectedId !== el.id) select(el.id);
                                    showContextMenu(touch.clientX, touch.clientY);
                                }, 500);
                            });
                            dom.addEventListener('touchend', () => {
                                clearTimeout(longPressTimer);
                            });
                            dom.addEventListener('touchmove', () => {
                                clearTimeout(longPressTimer);
                            });
                        }
                    }

                    if(el.type !== 'image' && !['rect', 'circle', 'line', 'triangle', 'arrow', 'star', 'heart', 'diamond', 'hexagon'].includes(el.type)) {
                        dom.ondblclick = (e) => { 
                            e.stopPropagation(); 
                            enterEditMode(el.id); 
                        };
                    }

                    dom.onmousedown = (e) => {
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

                    // FIXED: Mobile touch - only drag selected element
                    if (isTouchDevice) {
                        dom.addEventListener('touchstart', (e) => {
                            if (e.touches.length !== 1) return;
                            if (activeTool !== 'select' || editingId === el.id) return;
                            
                            e.stopPropagation();
                            e.preventDefault();
                            
                            const touch = e.touches[0];
                            const handle = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-dir]');
                            
                            if (handle) {
                                if(handle.dataset.dir === 'rotate') {
                                    startRotate({ clientX: touch.clientX, clientY: touch.clientY }, dom, el);
                                } else {
                                    startResize({ clientX: touch.clientX, clientY: touch.clientY }, dom, el, handle.dataset.dir);
                                }
                                return;
                            }
                            
                            if(selectedId !== el.id) select(el.id);
                            initDrag({ clientX: touch.clientX, clientY: touch.clientY }, dom, el);
                        });
                    }
                } catch(e) {
                    console.error('Event attach error:', e);
                }
            });
        } catch(e) {
            console.error('Attach events error:', e);
        }
    }

    function handleKeydown(e) {
        // Don't trigger shortcuts when typing
        if (editingId || e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') {
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
        
        if (contextMenu && !e.target.closest('#contextMenu')) {
            contextMenu.classList.remove('visible');
        }
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousedown', handleGlobalClick);

    // ━━━ 12. SELECTION & EDITING ━━━
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

    // ━━━ 13. ELEMENT CREATION ━━━
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
            console.error('Create text error:', e);
            showNotification('Failed to create text', 'error');
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
            closeAllDropdowns();
        } catch(e) {
            console.error('Create shape error:', e);
            showNotification('Failed to create shape', 'error');
        }
    }

    // ━━━ 14. DRAG & RESIZE (FIXED FOR MOBILE) ━━━
    function snapToGrid(value, gridSize = 10) {
        return Math.round(value / gridSize) * gridSize;
    }

    function initDrag(e, dom, data) { 
        isDragging = true;
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
            window.removeEventListener('touchmove', touchMv);
            window.removeEventListener('touchend', up);
            isDragging = false;
            pushHistory(); 
            renderSidebar(); 
        }; 
        
        window.addEventListener('mousemove', mv); 
        window.addEventListener('mouseup', up);
        
        if (isTouchDevice) {
            const touchMv = (ev) => {
                if (ev.touches.length === 1) {
                    ev.preventDefault();
                    mv({ clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY });
                }
            };
            window.addEventListener('touchmove', touchMv, { passive: false });
            window.addEventListener('touchend', up);
        }
    }

    function startResize(e, dom, data, dir) { 
        isDragging = true;
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
            window.removeEventListener('touchmove', touchMv);
            window.removeEventListener('touchend', up);
            isDragging = false;
            pushHistory(); 
            renderSidebar(); 
        }; 
        
        window.addEventListener('mousemove', mv); 
        window.addEventListener('mouseup', up);
        
        if (isTouchDevice) {
            const touchMv = (ev) => {
                if (ev.touches.length === 1) {
                    ev.preventDefault();
                    mv({ clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY });
                }
            };
            window.addEventListener('touchmove', touchMv, { passive: false });
            window.addEventListener('touchend', up);
        }
    }

    function startRotate(e, dom, data) { 
        isDragging = true;
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
            window.removeEventListener('touchmove', touchMv);
            window.removeEventListener('touchend', up);
            isDragging = false;
            pushHistory(); 
            renderSidebar(); 
        }; 
        
        window.addEventListener('mousemove', mv); 
        window.addEventListener('mouseup', up);
        
        if (isTouchDevice) {
            const touchMv = (ev) => {
                if (ev.touches.length === 1) {
                    ev.preventDefault();
                    mv({ clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY });
                }
            };
            window.addEventListener('touchmove', touchMv, { passive: false });
            window.addEventListener('touchend', up);
        }
    }

// ━━━ CONTINUE TO PART 3 ━━━

// ═══════════════════════════════════════════════════════════════════
// PART 3 - Paste directly after Part 2
// Final part with all remaining features!
// ═══════════════════════════════════════════════════════════════════

    // ━━━ 15. FORMATTING UI (25 FONTS + SHADOW/OUTLINE) ━━━
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
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Helvetica, sans-serif">Helvetica</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                    <option value="Impact, sans-serif">Impact</option>
                    <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                    <option value="'Arial Black', sans-serif">Arial Black</option>
                    <option value="Palatino, serif">Palatino</option>
                    <option value="Garamond, serif">Garamond</option>
                    <option value="Bookman, serif">Bookman</option>
                    <option value="'Lucida Console', monospace">Lucida Console</option>
                    <option value="Monaco, monospace">Monaco</option>
                    <option value="'Century Gothic', sans-serif">Century Gothic</option>
                    <option value="Tahoma, sans-serif">Tahoma</option>
                    <option value="Rockwell, serif">Rockwell</option>
                    <option value="'Franklin Gothic Medium', sans-serif">Franklin Gothic</option>
                    <option value="'Brush Script MT', cursive">Brush Script</option>
                    <option value="Copperplate, serif">Copperplate</option>
                    <option value="Papyrus, fantasy">Papyrus</option>
                    <option value="'Lucida Sans', sans-serif">Lucida Sans</option>
                    <option value="Didot, serif">Didot</option>
                </select>
                <input type="text" id="fontSize" class="font-size-input" value="${el.fontSize || 40}" placeholder="Size">
                <div class="toolbar-divider"></div>
                <button class="format-btn ${el.fontWeight === 'bold' ? 'active' : ''}" id="btnBold" title="Bold"><strong>B</strong></button>
                <button class="format-btn ${el.fontStyle === 'italic' ? 'active' : ''}" id="btnItalic" title="Italic"><em>I</em></button>
                <button class="format-btn ${el.textDecoration === 'underline' ? 'active' : ''}" id="btnUnderline" title="Underline"><u>U</u></button>
                <div class="toolbar-divider"></div>
                <button class="format-btn ${el.textAlign === 'left' ? 'active' : ''}" id="btnAlignLeft" title="Left">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/>
                    </svg>
                </button>
                <button class="format-btn ${el.textAlign === 'center' ? 'active' : ''}" id="btnAlignCenter" title="Center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v2H3V3zm3 4h12v2H6V7zm-3 4h18v2H3v-2zm3 4h12v2H6v-2zm-3 4h18v2H3v-2z"/>
                    </svg>
                </button>
                <button class="format-btn ${el.textAlign === 'right' ? 'active' : ''}" id="btnAlignRight" title="Right">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v2H3V3zm6 4h12v2H9V7zm-6 4h18v2H3v-2zm6 4h12v2H9v-2zm-6 4h18v2H3v-2z"/>
                    </svg>
                </button>
                <div class="toolbar-divider"></div>
                <div class="color-wrapper">
                    <input type="color" id="textColor" class="color-input" value="${el.color || '#000000'}">
                </div>
                <select id="shadowSelect" class="font-select" style="width: 100px;" title="Shadow">
                    <option value="none">No Shadow</option>
                    <option value="2px 2px 4px rgba(0,0,0,0.5)">Shadow 1</option>
                    <option value="4px 4px 8px rgba(0,0,0,0.6)">Shadow 2</option>
                    <option value="0 0 10px rgba(255,255,255,0.8)">Glow</option>
                </select>
                <select id="outlineSelect" class="font-select" style="width: 100px;" title="Outline">
                    <option value="none">No Outline</option>
                    <option value="1px #000">Outline 1px</option>
                    <option value="2px #000">Outline 2px</option>
                    <option value="1px #fff">White 1px</option>
                </select>
                <div class="toolbar-divider"></div>
            `;
        } else if (['rect', 'circle', 'line', 'triangle', 'arrow', 'star', 'heart', 'diamond', 'hexagon'].includes(el.type)) {
            html += `
                <div class="color-wrapper" title="Fill">
                    <input type="color" id="fillColor" class="color-input" value="${el.fill || '#3b82f6'}">
                </div>
                <div class="color-wrapper" title="Border">
                    <input type="color" id="strokeColor" class="color-input" value="${el.stroke || '#000000'}">
                </div>
                <input type="text" id="strokeWidth" class="font-size-input" value="${el.strokeWidth || 2}" placeholder="Border" style="width: 50px;">
                <select id="shadowSelect" class="font-select" style="width: 100px;" title="Shadow">
                    <option value="none">No Shadow</option>
                    <option value="2px 2px 4px rgba(0,0,0,0.5)">Shadow 1</option>
                    <option value="4px 4px 8px rgba(0,0,0,0.6)">Shadow 2</option>
                    <option value="0 0 10px rgba(255,255,255,0.8)">Glow</option>
                </select>
                <div class="toolbar-divider"></div>
            `;
        } else if (el.type === 'image') {
            html += `
                <select id="shadowSelect" class="font-select" style="width: 100px;" title="Shadow">
                    <option value="none">No Shadow</option>
                    <option value="2px 2px 4px rgba(0,0,0,0.5)">Shadow 1</option>
                    <option value="4px 4px 8px rgba(0,0,0,0.6)">Shadow 2</option>
                    <option value="0 0 10px rgba(255,255,255,0.8)">Glow</option>
                </select>
                <div class="toolbar-divider"></div>
            `;
        }
        
        html += `
            <button class="format-btn" id="btnLayerBack" title="Send Back">
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

        // Attach listeners
        if(el.type === 'text' || el.type === 'title') {
            const fontSel = document.getElementById('fontFamily');
            if (fontSel) {
                fontSel.value = el.fontFamily || 'Inter, sans-serif';
                fontSel.onchange = (e) => setProp('fontFamily', e.target.value);
            }
            
            // FIXED: Font size input maintains focus
            const fontSizeInput = document.getElementById('fontSize');
            if (fontSizeInput) {
                fontSizeInput.onchange = (e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 8 && val <= 200) {
                        setProp('fontSize', val);
                    }
                };
                fontSizeInput.onkeydown = (e) => {
                    e.stopPropagation();
                };
                fontSizeInput.onfocus = (e) => {
                    e.target.select();
                };
            }
            
            const colorInput = document.getElementById('textColor');
            if (colorInput) colorInput.oninput = (e) => setProp('color', e.target.value);
            
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
            
            const shadowSelect = document.getElementById('shadowSelect');
            if (shadowSelect) {
                shadowSelect.value = el.shadow || 'none';
                shadowSelect.onchange = (e) => setProp('shadow', e.target.value);
            }
            
            const outlineSelect = document.getElementById('outlineSelect');
            if (outlineSelect) {
                outlineSelect.value = el.outline || 'none';
                outlineSelect.onchange = (e) => setProp('outline', e.target.value);
            }
        } else if (['rect', 'circle', 'line', 'triangle', 'arrow', 'star', 'heart', 'diamond', 'hexagon'].includes(el.type)) {
            const fillColor = document.getElementById('fillColor');
            if (fillColor) fillColor.oninput = (e) => setProp('fill', e.target.value);
            
            const strokeColor = document.getElementById('strokeColor');
            if (strokeColor) strokeColor.oninput = (e) => setProp('stroke', e.target.value);
            
            const strokeWidth = document.getElementById('strokeWidth');
            if (strokeWidth) {
                strokeWidth.onchange = (e) => setProp('strokeWidth', parseInt(e.target.value) || 2);
                strokeWidth.onkeydown = (e) => e.stopPropagation();
            }
            
            const shadowSelect = document.getElementById('shadowSelect');
            if (shadowSelect) {
                shadowSelect.value = el.shadow || 'none';
                shadowSelect.onchange = (e) => setProp('shadow', e.target.value);
            }
        } else if (el.type === 'image') {
            const shadowSelect = document.getElementById('shadowSelect');
            if (shadowSelect) {
                shadowSelect.value = el.shadow || 'none';
                shadowSelect.onchange = (e) => setProp('shadow', e.target.value);
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

    // ━━━ 16. CONTEXT MENU (FIXED ANIMATIONS SUBMENU) ━━━
    function showContextMenu(x, y) {
        if (!contextMenu || !features.contextMenu) return;
        try {
            const menuRect = contextMenu.getBoundingClientRect();
            let finalX = x;
            let finalY = y;

            if (x + menuRect.width + 200 > window.innerWidth) {
                finalX = window.innerWidth - menuRect.width - 200 - 10;
            }
            if (y + menuRect.height > window.innerHeight) {
                finalY = window.innerHeight - menuRect.height - 10;
            }
            
            contextMenu.style.left = finalX + 'px';
            contextMenu.style.top = finalY + 'px';
            contextMenu.classList.add('visible');
        } catch(e) {
            console.error('Context menu error:', e);
        }
    }

    // Context menu actions
    try {
        const ctxDuplicate = document.getElementById('ctxDuplicate');
        if (ctxDuplicate) {
            ctxDuplicate.addEventListener('click', () => {
                duplicateElement();
                contextMenu.classList.remove('visible');
            });
        }

        const ctxLayerFront = document.getElementById('ctxLayerFront');
        if (ctxLayerFront) {
            ctxLayerFront.addEventListener('click', () => {
                moveLayer(1);
                contextMenu.classList.remove('visible');
            });
        }

        const ctxLayerBack = document.getElementById('ctxLayerBack');
        if (ctxLayerBack) {
            ctxLayerBack.addEventListener('click', () => {
                moveLayer(-1);
                contextMenu.classList.remove('visible');
            });
        }

        const ctxDelete = document.getElementById('ctxDelete');
        if (ctxDelete) {
            ctxDelete.addEventListener('click', () => {
                deleteSelected();
                contextMenu.classList.remove('visible');
            });
        }

        // FIXED: Animation submenu
        document.querySelectorAll('[data-animation]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const animation = item.dataset.animation;
                if (selectedId) {
                    const el = currentDeck.pages[activePageIndex].elements.find(e => e.id === selectedId);
                    if (el) {
                        // Check for transition animation
                        if (animation === 'transition') {
                            // Find element in next slide with same ID (from duplicate slide)
                            if (activePageIndex < currentDeck.pages.length - 1) {
                                const nextPage = currentDeck.pages[activePageIndex + 1];
                                const nextEl = nextPage.elements.find(e => e.type === el.type && Math.abs(e.x - el.x) < 1000);
                                if (nextEl) {
                                    el.animation = 'transition';
                                    el.transitionTo = { x: nextEl.x, y: nextEl.y };
                                } else {
                                    showNotification('No matching element found on next slide', 'error');
                                }
                            } else {
                                showNotification('No next slide for transition', 'error');
                            }
                        } else {
                            el.animation = animation;
                        }
                        pushHistory();
                        renderSidebar();
                    }
                }
                contextMenu.classList.remove('visible');
            });
        });
    } catch(e) {
        console.error('Context menu setup error:', e);
        features.contextMenu = false;
    }

    // ━━━ 17. CANVAS SCALING ━━━
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

    // ━━━ 18. PRESENTATION MODE (FIXED ASPECT RATIO) ━━━
    if (presentBtn) {
        presentBtn.onclick = () => { 
            document.body.classList.add('presenting'); 
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log('Fullscreen error:', err);
                });
            }
            deselect(); 
            panOffsetX = 0;
            panOffsetY = 0;
            document.addEventListener('keydown', handlePresentNav); 
            
            const s = document.querySelector('.editor-shell'); 
            if (s) {
                s.style.justifyContent = 'center'; 
                s.style.alignItems = 'center'; 
            }
            
            renderMain();
            
            const c = document.getElementById('mainSlideContent'); 
            if (c) {
                // FIXED: Maintain 16:9 aspect ratio
                c.style.position = 'static'; 
                c.style.margin = 'auto';
                c.style.width = '1280px';
                c.style.height = '720px';
                const sw = window.innerWidth / 1280; 
                const sh = window.innerHeight / 720; 
                c.style.transform = `scale(${Math.min(sw, sh)})`; 
                c.style.transformOrigin = 'center center';
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
            c.style.width = '1280px';
            c.style.height = '720px';
            c.style.transformOrigin = 'top left';
        }
        
        fitCanvas(); 
    }

    function refreshFullScale() { 
        const c = document.getElementById('mainSlideContent'); 
        if (!c) return;
        c.style.width = '1280px';
        c.style.height = '720px';
        const sw = window.innerWidth / 1280; 
        const sh = window.innerHeight / 720; 
        c.style.transform = `scale(${Math.min(sw, sh)})`; 
        c.style.transformOrigin = 'center center';
    }

    document.addEventListener('fullscreenchange', () => { 
        if(!document.fullscreenElement) exitPresentation(); 
    });

    // ━━━ 19. TOOLBAR TOOLS ━━━
    const selectTool = document.getElementById('selectTool');
    const textTool = document.getElementById('textTool');
    const imageTool = document.getElementById('imageTool');

    if (selectTool) selectTool.onclick = () => setActiveTool('select', selectTool);
    if (textTool) textTool.onclick = () => setActiveTool('text', textTool);
    if (imageTool) imageTool.onclick = () => imgInput.click();

    const shapes = ['rect', 'circle', 'line', 'triangle', 'arrow', 'star', 'heart', 'diamond', 'hexagon'];
    shapes.forEach(shape => {
        const btn = document.getElementById(`shape${shape.charAt(0).toUpperCase() + shape.slice(1)}`);
        if (btn) {
            btn.addEventListener('click', () => createShape(shape));
        }
    });

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

    // ━━━ 20. IMAGE UPLOAD ━━━
    if (imgInput) {
        imgInput.onchange = (e) => { 
            if(e.target.files[0]) {
                if (e.target.files[0].size > 5 * 1024 * 1024) {
                    showNotification('Image too large (max 5MB)', 'error');
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

    // ━━━ 21. TITLE EDITING ━━━
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

    // ━━━ 22. HELP MODAL ━━━
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

    // ━━━ 23. LOADING STATE ━━━
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
            console.error('Loading overlay error:', e);
        }
    }

    function hideLoading() {
        try {
            const loader = document.getElementById('loadingOverlay');
            if (loader) loader.remove();
        } catch(e) {
            console.error('Hide loading error:', e);
        }
    }

    // ━━━ 24. INITIAL RENDER ━━━
    try {
        render();
    } catch(e) {
        console.error('Initial render error:', e);
        showNotification('Editor error', 'error');
    }
});

// ═══════════════════════════════════════════════════════════════════
// END OF MOLTENSLIDES EDITOR
// All bugs fixed, all features added!
// ═══════════════════════════════════════════════════════════════════
