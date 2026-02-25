// ═══════════════════════════════════════════════════════════════
// MOLTENDRAW ENGINE v2.0
// Full canvas drawing with layers, tools, stabilization, undo
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'moltenDraw_v1';

    // ━━━ DOM ━━━
    const mainCanvas = document.getElementById('mainCanvas');
    const canvasContainer = document.getElementById('canvasContainer');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const toolStrip = document.getElementById('toolStrip');
    const settingsPanel = document.getElementById('settingsPanel');
    const panelToggle = document.getElementById('panelToggle');
    const brushSizeSlider = document.getElementById('brushSize');
    const brushSizeVal = document.getElementById('brushSizeVal');
    const brushOpacitySlider = document.getElementById('brushOpacity');
    const brushOpacityVal = document.getElementById('brushOpacityVal');
    const stabSlider = document.getElementById('stabAmount');
    const stabVal = document.getElementById('stabAmountVal');
    const colorPicker = document.getElementById('colorPicker');
    const recentColorsEl = document.getElementById('recentColors');
    const layerListEl = document.getElementById('layerList');
    const addLayerBtn = document.getElementById('addLayerBtn');
    const fileMenuBtn = document.getElementById('fileMenuBtn');
    const fileMenu = document.getElementById('fileMenu');
    const btnImportJSON = document.getElementById('btnImportJSON');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const btnExportPNG = document.getElementById('btnExportPNG');
    const btnNewCanvas = document.getElementById('btnNewCanvas');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnZoomReset = document.getElementById('btnZoomReset');
    const zoomLabel = document.getElementById('zoomLabel');
    const jsonInput = document.getElementById('jsonInput');
    const toolSettingsEl = document.getElementById('toolSettings');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    // ━━━ STATE ━━━
    const CANVAS_W = 1920;
    const CANVAS_H = 1080;
    let currentTool = 'pencil';
    let brushSize = 6;
    let brushOpacity = 1;
    let stabAmount = 8; // 0 = off, higher = more smoothing
    let currentColor = '#000000';
    let recentColors = ['#000000', '#ffffff', '#ff5e3a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    let zoom = 1;
    let panX = 0, panY = 0;
    let isPanning = false;
    let panStartX, panStartY, panStartPX, panStartPY;

    // Layers
    let layers = [];
    let activeLayerIdx = 0;

    // Drawing
    let isDrawing = false;
    let lastX = 0, lastY = 0;
    let stabBuffer = [];
    let strokeCanvas = null; // For highlighter isolation

    // Undo/Redo — stores per-layer image data
    let undoStack = [];
    let redoStack = [];
    const MAX_UNDO = 40;

    // Move tool
    let moveStartX, moveStartY, moveLayerData;

    // Shape tool
    let shapeStartX = 0, shapeStartY = 0;
    let shapePreviewCanvas = null;

    // Checkerboard bg for transparency
    let checkerPattern = null;

    // Drag layers
    let dragLayerIdx = -1;
    let dragOverIdx = -1;

    // ━━━ INIT ━━━
    mainCanvas.width = CANVAS_W;
    mainCanvas.height = CANVAS_H;
    const displayCtx = mainCanvas.getContext('2d');

    // Create checkerboard pattern
    (function createChecker() {
        const size = 16;
        const pc = document.createElement('canvas');
        pc.width = size * 2; pc.height = size * 2;
        const pctx = pc.getContext('2d');
        pctx.fillStyle = '#e0e0e0'; pctx.fillRect(0, 0, size * 2, size * 2);
        pctx.fillStyle = '#cccccc';
        pctx.fillRect(0, 0, size, size);
        pctx.fillRect(size, size, size, size);
        checkerPattern = displayCtx.createPattern(pc, 'repeat');
    })();

    function createLayerCanvas() {
        const c = document.createElement('canvas');
        c.width = CANVAS_W; c.height = CANVAS_H;
        return c;
    }

    function addLayer(name, fillWhite = false) {
        const canvas = createLayerCanvas();
        if (fillWhite) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }
        layers.push({ name: name || `Layer ${layers.length + 1}`, canvas, visible: true, opacity: 1 });
        activeLayerIdx = layers.length - 1;
        renderLayers();
        renderLayerList();
    }

    addLayer('Background', true);
    renderLayers();

    // ━━━ RENDER COMPOSITE ━━━
    function renderLayers() {
        displayCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        // Draw checker for transparency
        displayCtx.fillStyle = checkerPattern;
        displayCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        layers.forEach(layer => {
            if (!layer.visible) return;
            displayCtx.globalAlpha = layer.opacity;
            displayCtx.drawImage(layer.canvas, 0, 0);
        });
        displayCtx.globalAlpha = 1;
    }

    function fitCanvas() {
        const rect = canvasContainer.getBoundingClientRect();
        const scaleX = rect.width / CANVAS_W;
        const scaleY = rect.height / CANVAS_H;
        zoom = Math.min(scaleX, scaleY) * 0.88;
        panX = 0; panY = 0;
        updateCanvasTransform();
    }

    function updateCanvasTransform() {
        canvasWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
    }

    // ━━━ COORDS ━━━
    function getCanvasCoords(e) {
        const rect = mainCanvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / (rect.width / CANVAS_W),
            y: (e.clientY - rect.top) / (rect.height / CANVAS_H),
            pressure: e.pressure || 0.5
        };
    }

    // ━━━ UNDO/REDO (instant) ━━━
    function captureState() {
        return layers.map(l => ({
            name: l.name, visible: l.visible, opacity: l.opacity,
            imgData: l.canvas.getContext('2d').getImageData(0, 0, CANVAS_W, CANVAS_H)
        }));
    }

    function pushUndo() {
        undoStack.push({ state: captureState(), activeIdx: activeLayerIdx });
        if (undoStack.length > MAX_UNDO) undoStack.shift();
        redoStack = [];
    }

    function restoreState(snapshot) {
        layers = [];
        snapshot.state.forEach(s => {
            const canvas = createLayerCanvas();
            canvas.getContext('2d').putImageData(s.imgData, 0, 0);
            layers.push({ name: s.name, visible: s.visible, opacity: s.opacity, canvas });
        });
        activeLayerIdx = Math.min(snapshot.activeIdx, layers.length - 1);
        renderLayers();
        renderLayerList();
    }

    function undo() {
        if (undoStack.length === 0) return;
        redoStack.push({ state: captureState(), activeIdx: activeLayerIdx });
        restoreState(undoStack.pop());
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack.push({ state: captureState(), activeIdx: activeLayerIdx });
        restoreState(redoStack.pop());
    }

    btnUndo.onclick = undo;
    btnRedo.onclick = redo;

    // ━━━ STABILIZATION (weighted average) ━━━
    function smoothPoint(buffer) {
        if (buffer.length < 2) return buffer[buffer.length - 1];
        let sx = 0, sy = 0, totalW = 0;
        const len = buffer.length;
        for (let i = 0; i < len; i++) {
            const w = (i + 1); // weight increases for recent points
            sx += buffer[i].x * w;
            sy += buffer[i].y * w;
            totalW += w;
        }
        return { x: sx / totalW, y: sy / totalW };
    }

    // ━━━ DRAWING ━━━
    function getLineWidth(pressure) {
        const base = brushSize;
        if (currentTool === 'marker') return base * 2.5;
        if (currentTool === 'highlighter') return base * 3;
        if (currentTool === 'eraser') return base * 2;
        if (currentTool === 'pen') return base * (pressure * 1.2 + 0.4);
        return Math.max(1, base);
    }

    function startDraw(coords) {
        if (!layers[activeLayerIdx]) return;
        isDrawing = true;
        pushUndo();

        // For highlighter: draw to isolated canvas, composite on end
        if (currentTool === 'highlighter') {
            strokeCanvas = createLayerCanvas();
        }

        stabBuffer = [{ x: coords.x, y: coords.y }];
        lastX = coords.x;
        lastY = coords.y;

        const ctx = getDrawCtx();
        setupCtx(ctx, coords.pressure);
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        renderLayers();
    }

    function getDrawCtx() {
        if (currentTool === 'highlighter' && strokeCanvas) {
            return strokeCanvas.getContext('2d');
        }
        return layers[activeLayerIdx].canvas.getContext('2d');
    }

    function setupCtx(ctx, pressure) {
        if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = brushOpacity;
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#000';
        } else if (currentTool === 'highlighter') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1; // full alpha on stroke canvas
            ctx.fillStyle = currentColor;
            ctx.strokeStyle = currentColor;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = brushOpacity;
            ctx.fillStyle = currentColor;
            ctx.strokeStyle = currentColor;
        }

        ctx.lineWidth = getLineWidth(pressure);
        ctx.lineCap = (currentTool === 'marker' || currentTool === 'highlighter') ? 'square' : 'round';
        ctx.lineJoin = (currentTool === 'marker' || currentTool === 'highlighter') ? 'miter' : 'round';
    }

    function continueDraw(coords) {
        if (!isDrawing || !layers[activeLayerIdx]) return;

        let drawX = coords.x, drawY = coords.y;

        // Stabilization
        if (stabAmount > 0 && currentTool !== 'eraser') {
            stabBuffer.push({ x: coords.x, y: coords.y });
            if (stabBuffer.length > stabAmount) stabBuffer.shift();
            const s = smoothPoint(stabBuffer);
            drawX = s.x;
            drawY = s.y;
        }

        const ctx = getDrawCtx();
        setupCtx(ctx, coords.pressure);

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
<<<<<<< HEAD
        ctx.lineTo(drawX, drawY);
=======
<<<<<<< HEAD
        ctx.lineTo(drawX, drawY);
=======
<<<<<<< HEAD
        ctx.lineTo(drawX, drawY);
=======

        // Quadratic curve for smoother lines
        const mx = (lastX + drawX) / 2;
        const my = (lastY + drawY) / 2;
        ctx.quadraticCurveTo(lastX, lastY, mx, my);
>>>>>>> 1fd25a3d3770c0376e20448cbdcafd0540a99ea0
>>>>>>> 08e2c62dffa3f4807420f6dac59af6bc096bbbc8
>>>>>>> f6f03b8de292ccbe41060c48ead3853a01af4149
        ctx.stroke();

        lastX = drawX;
        lastY = drawY;

        // For highlighter render preview
        if (currentTool === 'highlighter' && strokeCanvas) {
            renderLayers();
            // Composite stroke canvas on top with opacity
            displayCtx.globalAlpha = brushOpacity * 0.4;
            displayCtx.drawImage(strokeCanvas, 0, 0);
            displayCtx.globalAlpha = 1;
        } else {
            renderLayers();
        }
    }

    function endDraw() {
        if (!isDrawing) return;
        isDrawing = false;

        // Highlighter: composite isolated stroke onto layer
        if (currentTool === 'highlighter' && strokeCanvas && layers[activeLayerIdx]) {
            const ctx = layers[activeLayerIdx].canvas.getContext('2d');
            ctx.globalAlpha = brushOpacity * 0.4;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(strokeCanvas, 0, 0);
            ctx.globalAlpha = 1;
            strokeCanvas = null;
        }

        const ctx = layers[activeLayerIdx]?.canvas.getContext('2d');
        if (ctx) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }

        stabBuffer = [];
        renderLayers();
        autoSave();
    }

    // ━━━ FILL BUCKET ━━━
    function floodFill(startX, startY) {
        if (!layers[activeLayerIdx]) return;
        pushUndo();
        const ctx = layers[activeLayerIdx].canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        const data = imageData.data;
        const sx = Math.round(startX), sy = Math.round(startY);
        if (sx < 0 || sx >= CANVAS_W || sy < 0 || sy >= CANVAS_H) return;

        const idx = (sy * CANVAS_W + sx) * 4;
        const tR = data[idx], tG = data[idx + 1], tB = data[idx + 2], tA = data[idx + 3];
        const fill = hexToRgb(currentColor);
        const fA = Math.round(brushOpacity * 255);

        if (tR === fill.r && tG === fill.g && tB === fill.b && tA === fA) return;

        const tol = 32;
        const stack = [[sx, sy]];
        const visited = new Uint8Array(CANVAS_W * CANVAS_H);

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            if (cx < 0 || cx >= CANVAS_W || cy < 0 || cy >= CANVAS_H) continue;
            const ci = cy * CANVAS_W + cx;
            if (visited[ci]) continue;
            const pi = ci * 4;
            if (Math.abs(data[pi] - tR) > tol || Math.abs(data[pi + 1] - tG) > tol ||
                Math.abs(data[pi + 2] - tB) > tol || Math.abs(data[pi + 3] - tA) > tol) continue;
            visited[ci] = 1;
            data[pi] = fill.r; data[pi + 1] = fill.g; data[pi + 2] = fill.b; data[pi + 3] = fA;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }

        ctx.putImageData(imageData, 0, 0);
        renderLayers();
        autoSave();
    }

    // ━━━ EYEDROPPER ━━━
    function pickColor(coords) {
        const pixel = displayCtx.getImageData(Math.round(coords.x), Math.round(coords.y), 1, 1).data;
        setColor('#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
    }

    // ━━━ MOVE ━━━
    function startMove(coords) {
        if (!layers[activeLayerIdx]) return;
        pushUndo();
        moveStartX = coords.x; moveStartY = coords.y;
        moveLayerData = layers[activeLayerIdx].canvas.getContext('2d').getImageData(0, 0, CANVAS_W, CANVAS_H);
    }

    function continueMove(coords) {
        if (!moveLayerData || !layers[activeLayerIdx]) return;
        const dx = Math.round(coords.x - moveStartX);
        const dy = Math.round(coords.y - moveStartY);
        const ctx = layers[activeLayerIdx].canvas.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.putImageData(moveLayerData, dx, dy);
        renderLayers();
    }

    function endMove() { moveLayerData = null; autoSave(); }

    // ━━━ SHAPES ━━━
    function startShape(coords) {
        if (!layers[activeLayerIdx]) return;
        pushUndo();
        shapeStartX = coords.x;
        shapeStartY = coords.y;
        shapePreviewCanvas = createLayerCanvas();
        isDrawing = true;
    }

    function continueShape(coords) {
        if (!isDrawing || !shapePreviewCanvas) return;
        const ctx = shapePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = brushSize;
        ctx.globalAlpha = brushOpacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const x1 = shapeStartX, y1 = shapeStartY;
        const x2 = coords.x, y2 = coords.y;
        const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
        const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);

        ctx.beginPath();
        if (currentTool === 'rect') {
            ctx.strokeRect(rx, ry, rw, rh);
        } else if (currentTool === 'ellipse') {
            ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (currentTool === 'line') {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        renderLayers();
        displayCtx.drawImage(shapePreviewCanvas, 0, 0);
    }

    function endShape() {
        if (!isDrawing || !shapePreviewCanvas || !layers[activeLayerIdx]) { isDrawing = false; return; }
        isDrawing = false;
        const ctx = layers[activeLayerIdx].canvas.getContext('2d');
        ctx.drawImage(shapePreviewCanvas, 0, 0);
        shapePreviewCanvas = null;
        renderLayers();
        autoSave();
    }

    const SHAPE_TOOLS = ['rect', 'ellipse', 'line'];

    // ━━━ POINTER EVENTS ━━━
    function handlePointerDown(e) {
        fileMenu.classList.add('hidden');
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            isPanning = true;
            panStartX = e.clientX; panStartY = e.clientY;
            panStartPX = panX; panStartPY = panY;
            canvasContainer.style.cursor = 'grabbing';
            return;
        }
        const coords = getCanvasCoords(e);
        if (currentTool === 'fill') { floodFill(coords.x, coords.y); return; }
        if (currentTool === 'eyedropper') { pickColor(coords); return; }
        if (currentTool === 'move') { startMove(coords); return; }
        if (SHAPE_TOOLS.includes(currentTool)) { startShape(coords); return; }
        startDraw(coords);
    }

    function handlePointerMove(e) {
        if (isPanning) {
            panX = panStartPX + (e.clientX - panStartX);
            panY = panStartPY + (e.clientY - panStartY);
            updateCanvasTransform(); return;
        }
        const coords = getCanvasCoords(e);
        if (currentTool === 'move' && moveLayerData) { continueMove(coords); return; }
        if (SHAPE_TOOLS.includes(currentTool) && isDrawing) { continueShape(coords); return; }
        continueDraw(coords);
    }

    function handlePointerUp() {
        if (isPanning) { isPanning = false; canvasContainer.style.cursor = 'crosshair'; return; }
        if (currentTool === 'move') { endMove(); return; }
        if (SHAPE_TOOLS.includes(currentTool)) { endShape(); return; }
        endDraw();
    }

    mainCanvas.addEventListener('pointerdown', handlePointerDown);
    mainCanvas.addEventListener('pointermove', handlePointerMove);
    mainCanvas.addEventListener('pointerup', handlePointerUp);
    mainCanvas.addEventListener('pointerleave', handlePointerUp);
    mainCanvas.addEventListener('pointercancel', handlePointerUp);
    mainCanvas.addEventListener('contextmenu', e => e.preventDefault());
    mainCanvas.style.touchAction = 'none';

    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoom = Math.max(0.1, Math.min(5, zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
        updateCanvasTransform();
    }, { passive: false });

    // ━━━ TOOL SELECTION ━━━
    toolStrip.addEventListener('click', (e) => {
        const btn = e.target.closest('.tool-btn');
        if (!btn || !btn.dataset.tool) return;
        selectTool(btn.dataset.tool);
    });

    function selectTool(tool) {
        currentTool = tool;
        toolStrip.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
        canvasContainer.style.cursor = tool === 'move' ? 'move' : tool === 'eyedropper' ? 'crosshair' : 'crosshair';
        updateToolSettings();
    }

    // ━━━ TOOL-SPECIFIC SETTINGS ━━━
    function updateToolSettings() {
        if (!toolSettingsEl) return;
        let html = '';
        const t = currentTool;
        const toolNames = { pencil: 'Pencil', pen: 'Pen', marker: 'Marker', highlighter: 'Highlighter', eraser: 'Eraser', fill: 'Fill Bucket', eyedropper: 'Eyedropper', move: 'Move', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line' };
        html += `<div class="tool-name">${toolNames[t] || t}</div>`;

        if (['pencil', 'pen', 'marker', 'highlighter', 'eraser'].includes(t)) {
            html += `<div class="tool-hint">Size: ${brushSize}px</div>`;
            if (t === 'pen') html += `<div class="tool-hint">Pressure-sensitive</div>`;
            if (t === 'highlighter') html += `<div class="tool-hint">Semi-transparent overlay</div>`;
            if (t === 'marker') html += `<div class="tool-hint">Thick flat strokes</div>`;
            if (t === 'eraser') html += `<div class="tool-hint">Erases to transparent</div>`;
        }
        if (t === 'fill') html += `<div class="tool-hint">Click to flood fill area</div>`;
        if (t === 'eyedropper') html += `<div class="tool-hint">Click to pick color</div>`;
        if (t === 'move') html += `<div class="tool-hint">Drag to move layer content</div>`;
        if (t === 'rect') html += `<div class="tool-hint">Click & drag to draw rectangle</div>`;
        if (t === 'ellipse') html += `<div class="tool-hint">Click & drag to draw ellipse</div>`;
        if (t === 'line') html += `<div class="tool-hint">Click & drag to draw line</div>`;

        toolSettingsEl.innerHTML = html;
    }

    // ━━━ BRUSH SETTINGS ━━━
    if (brushSizeSlider) {
        brushSizeSlider.value = brushSize;
        brushSizeSlider.oninput = () => { brushSize = parseInt(brushSizeSlider.value); brushSizeVal.textContent = brushSize; updateToolSettings(); };
    }
    if (brushOpacitySlider) {
        brushOpacitySlider.oninput = () => { brushOpacity = parseInt(brushOpacitySlider.value) / 100; brushOpacityVal.textContent = parseInt(brushOpacitySlider.value); };
    }
    if (stabSlider) {
        stabSlider.value = stabAmount;
        stabSlider.oninput = () => { stabAmount = parseInt(stabSlider.value); stabVal.textContent = stabAmount; };
    }

    // ━━━ COLOR ━━━
    function setColor(hex) {
        currentColor = hex;
        colorPicker.value = hex;
        addRecentColor(hex);
        renderRecentColors();
    }
    colorPicker.oninput = (e) => setColor(e.target.value);

    function addRecentColor(hex) {
        const i = recentColors.indexOf(hex);
        if (i !== -1) recentColors.splice(i, 1);
        recentColors.unshift(hex);
        if (recentColors.length > 14) recentColors.pop();
    }

    function renderRecentColors() {
        recentColorsEl.innerHTML = '';
        recentColors.forEach(c => {
            const s = document.createElement('div');
            s.className = 'recent-swatch';
            s.style.background = c;
            s.onclick = () => setColor(c);
            recentColorsEl.appendChild(s);
        });
    }
    renderRecentColors();

    // ━━━ LAYERS ━━━
    addLayerBtn.onclick = () => { pushUndo(); addLayer(); };

    function getLayerThumb(layer) {
        const t = document.createElement('canvas');
        t.width = 40; t.height = 24;
        const tc = t.getContext('2d');
        // Mini checkerboard
        tc.fillStyle = '#ddd'; tc.fillRect(0, 0, 40, 24);
        tc.fillStyle = '#bbb';
        for (let y = 0; y < 24; y += 6) for (let x = (y % 12 === 0 ? 0 : 6); x < 40; x += 12) tc.fillRect(x, y, 6, 6);
        tc.drawImage(layer.canvas, 0, 0, 40, 24);
        return t.toDataURL('image/png');
    }

    function renderLayerList() {
        layerListEl.innerHTML = '';
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const item = document.createElement('div');
            item.className = 'layer-item' + (i === activeLayerIdx ? ' active' : '');
            item.draggable = true;
            item.dataset.idx = i;

            const thumb = getLayerThumb(layer);

            item.innerHTML = `
                <button class="layer-vis" title="${layer.visible ? 'Hide' : 'Show'}">${layer.visible ? '👁' : '—'}</button>
                <img class="layer-thumb" src="${thumb}" alt="" draggable="false">
                <span class="layer-name">${layer.name}</span>
                <button class="layer-del" title="Delete">✕</button>
            `;

            // Visibility toggle
            item.querySelector('.layer-vis').onclick = (e) => {
                e.stopPropagation();
                pushUndo();
                layer.visible = !layer.visible;
                renderLayers(); renderLayerList();
            };

            // Delete
            item.querySelector('.layer-del').onclick = (e) => {
                e.stopPropagation();
                if (layers.length <= 1) { showNotification('Need at least one layer'); return; }
                pushUndo();
                layers.splice(i, 1);
                if (activeLayerIdx >= layers.length) activeLayerIdx = layers.length - 1;
                renderLayers(); renderLayerList();
            };

            // Double-click rename
            item.querySelector('.layer-name').ondblclick = (e) => {
                e.stopPropagation();
                const span = e.target;
                const input = document.createElement('input');
                input.type = 'text'; input.value = layer.name;
                input.style.cssText = 'width:100%;background:var(--bg-input);border:1px solid var(--accent-cyan);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.8rem;font-family:var(--font-main);outline:none;';
                span.replaceWith(input);
                input.focus(); input.select();
                const done = () => { layer.name = input.value.trim() || layer.name; renderLayerList(); };
                input.onblur = done;
                input.onkeydown = (ev) => { if (ev.key === 'Enter') done(); ev.stopPropagation(); };
            };

            // Select layer
            item.onclick = () => { activeLayerIdx = i; renderLayerList(); };

            // Drag to reorder
            item.ondragstart = (e) => {
                dragLayerIdx = i;
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('dragging');
            };
            item.ondragend = () => { dragLayerIdx = -1; item.classList.remove('dragging'); };
            item.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
                dragOverIdx = i;
            };
            item.ondragleave = () => { item.classList.remove('drag-over'); };
            item.ondrop = (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (dragLayerIdx === -1 || dragLayerIdx === i) return;
                pushUndo();
                const [moved] = layers.splice(dragLayerIdx, 1);
                layers.splice(i, 0, moved);
                if (activeLayerIdx === dragLayerIdx) activeLayerIdx = i;
                else if (dragLayerIdx < activeLayerIdx && i >= activeLayerIdx) activeLayerIdx--;
                else if (dragLayerIdx > activeLayerIdx && i <= activeLayerIdx) activeLayerIdx++;
                renderLayers(); renderLayerList();
                dragLayerIdx = -1;
            };

            layerListEl.appendChild(item);
        }
    }
    renderLayerList();

    // ━━━ ZOOM ━━━
    if (btnZoomIn) btnZoomIn.onclick = () => { zoom = Math.min(5, zoom + 0.15); updateCanvasTransform(); };
    if (btnZoomOut) btnZoomOut.onclick = () => { zoom = Math.max(0.1, zoom - 0.15); updateCanvasTransform(); };
    if (btnZoomReset) btnZoomReset.onclick = fitCanvas;

    // ━━━ FILE MENU ━━━
    fileMenuBtn.onclick = (e) => { e.stopPropagation(); fileMenu.classList.toggle('hidden'); };
    document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown-wrap')) fileMenu.classList.add('hidden'); });

    btnExportJSON.onclick = () => {
        fileMenu.classList.add('hidden');
        const data = {
            type: 'moltendraw', version: 2, width: CANVAS_W, height: CANVAS_H,
            layers: layers.map(l => ({ name: l.name, visible: l.visible, opacity: l.opacity, data: l.canvas.toDataURL('image/png') }))
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'MoltenDraw_Project.json'; a.click(); URL.revokeObjectURL(a.href);
        showNotification('JSON exported!');
    };

<<<<<<< HEAD
    btnImportJSON.onclick = async () => {
        fileMenu.classList.add('hidden');
        if (!await AppModal.confirm('Import will replace your current canvas. Continue?', 'Import Notice')) return;
=======
<<<<<<< HEAD
    btnImportJSON.onclick = async () => {
        fileMenu.classList.add('hidden');
        if (!await AppModal.confirm('Import will replace your current canvas. Continue?', 'Import Notice')) return;
=======
<<<<<<< HEAD
    btnImportJSON.onclick = async () => {
        fileMenu.classList.add('hidden');
        if (!await AppModal.confirm('Import will replace your current canvas. Continue?', 'Import Notice')) return;
=======
    btnImportJSON.onclick = () => {
        fileMenu.classList.add('hidden');
        if (!confirm('Import will replace your current canvas. Continue?')) return;
>>>>>>> 1fd25a3d3770c0376e20448cbdcafd0540a99ea0
>>>>>>> 08e2c62dffa3f4807420f6dac59af6bc096bbbc8
>>>>>>> f6f03b8de292ccbe41060c48ead3853a01af4149
        jsonInput.click();
    };

    jsonInput.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (data.type !== 'moltendraw' || !data.layers) { showNotification('Invalid file'); return; }
            pushUndo();
            layers = [];
            for (const ld of data.layers) {
                const canvas = createLayerCanvas();
                const ctx = canvas.getContext('2d');
                const img = new Image();
                await new Promise(r => { img.onload = r; img.src = ld.data; });
                ctx.drawImage(img, 0, 0);
                layers.push({ name: ld.name, visible: ld.visible, opacity: ld.opacity, canvas });
            }
            activeLayerIdx = 0; renderLayers(); renderLayerList();
            showNotification('Imported!');
        } catch (err) { showNotification('Import failed'); }
        jsonInput.value = '';
    };

    btnExportPNG.onclick = () => {
        fileMenu.classList.add('hidden');
        const flat = createLayerCanvas();
        const fCtx = flat.getContext('2d');
        layers.forEach(l => { if (!l.visible) return; fCtx.globalAlpha = l.opacity; fCtx.drawImage(l.canvas, 0, 0); });
        fCtx.globalAlpha = 1;
        flat.toBlob(blob => {
            if (!blob) { showNotification('Export failed'); return; }
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = 'MoltenDraw_Export.png'; a.click(); URL.revokeObjectURL(a.href);
            showNotification('PNG downloaded!');
        }, 'image/png');
    };

<<<<<<< HEAD
    btnNewCanvas.onclick = async () => {
        fileMenu.classList.add('hidden');
        if (!await AppModal.confirm('Clear canvas and start fresh?', 'New Canvas')) return;
=======
<<<<<<< HEAD
    btnNewCanvas.onclick = async () => {
        fileMenu.classList.add('hidden');
        if (!await AppModal.confirm('Clear canvas and start fresh?', 'New Canvas')) return;
=======
<<<<<<< HEAD
    btnNewCanvas.onclick = async () => {
        fileMenu.classList.add('hidden');
        if (!await AppModal.confirm('Clear canvas and start fresh?', 'New Canvas')) return;
=======
    btnNewCanvas.onclick = () => {
        fileMenu.classList.add('hidden');
        if (!confirm('Clear canvas and start fresh?')) return;
>>>>>>> 1fd25a3d3770c0376e20448cbdcafd0540a99ea0
>>>>>>> 08e2c62dffa3f4807420f6dac59af6bc096bbbc8
>>>>>>> f6f03b8de292ccbe41060c48ead3853a01af4149
        pushUndo();
        layers = []; activeLayerIdx = 0; addLayer('Background', true);
        renderLayers(); renderLayerList();
        showNotification('New canvas');
    };

    // ━━━ MOBILE PANEL ━━━
    if (panelToggle) panelToggle.onclick = () => settingsPanel.classList.toggle('open');
    if (mobileMenuBtn) mobileMenuBtn.onclick = () => settingsPanel.classList.toggle('open');

    // ━━━ KEYBOARD ━━━
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); zoom = Math.min(5, zoom + 0.15); updateCanvasTransform(); }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoom = Math.max(0.1, zoom - 0.15); updateCanvasTransform(); }
        if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); fitCanvas(); }

        switch (e.key.toLowerCase()) {
            case 'b': selectTool('pencil'); break;
            case 'p': selectTool('pen'); break;
            case 'm': selectTool('marker'); break;
            case 'h': selectTool('highlighter'); break;
            case 'e': selectTool('eraser'); break;
            case 'g': selectTool('fill'); break;
            case 'i': selectTool('eyedropper'); break;
            case 'v': selectTool('move'); break;
            case 'r': selectTool('rect'); break;
            case 'o': selectTool('ellipse'); break;
            case 'l': selectTool('line'); break;
            case '[': if (brushSizeSlider) { brushSizeSlider.value = Math.max(1, brushSize - 2); brushSizeSlider.oninput(); } break;
            case ']': if (brushSizeSlider) { brushSizeSlider.value = Math.min(100, brushSize + 2); brushSizeSlider.oninput(); } break;
        }
    });

    // ━━━ AUTO-SAVE ━━━
    let saveTimer = null;
    function autoSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                const thumb = document.createElement('canvas');
                thumb.width = 320; thumb.height = 180;
                const tCtx = thumb.getContext('2d');
                tCtx.drawImage(mainCanvas, 0, 0, 320, 180);
                const data = {
                    id: getProjectId(),
                    title: 'Untitled Drawing',
                    date: new Date().toLocaleDateString(),
                    thumbnail: thumb.toDataURL('image/jpeg', 0.6),
<<<<<<< HEAD
                    layerCount: layers.length,
                    layers: layers.map(l => ({ name: l.name, visible: l.visible, opacity: l.opacity, data: l.canvas.toDataURL('image/png') }))
=======
<<<<<<< HEAD
                    layerCount: layers.length,
                    layers: layers.map(l => ({ name: l.name, visible: l.visible, opacity: l.opacity, data: l.canvas.toDataURL('image/png') }))
=======
                    layerCount: layers.length
>>>>>>> 08e2c62dffa3f4807420f6dac59af6bc096bbbc8
>>>>>>> f6f03b8de292ccbe41060c48ead3853a01af4149
                };
                let projects = [];
                try { projects = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { projects = []; }
                const idx = projects.findIndex(p => p.id === data.id);
                if (idx !== -1) projects[idx] = data; else projects.unshift(data);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
            } catch (e) { /* storage full */ }
        }, 1500);
    }

    function getProjectId() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('id')) || 0;
    }

    // ━━━ HELPERS ━━━
    function hexToRgb(hex) {
        return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
    }

    function showNotification(msg) {
        const n = document.createElement('div');
        n.className = 'notification'; n.textContent = msg;
        document.body.appendChild(n);
        requestAnimationFrame(() => n.classList.add('show'));
        setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2000);
    }

    // ━━━ INIT ━━━
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> f6f03b8de292ccbe41060c48ead3853a01af4149
    async function initLoader() {
        const pid = getProjectId();
        let projects = [];
        try { projects = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { }
        const p = projects.find(x => x.id === pid);

        if (p && p.layers && p.layers.length > 0) {
            layers = [];
            for (const ld of p.layers) {
                const canvas = createLayerCanvas();
                const ctx = canvas.getContext('2d');
                const img = new Image();
                await new Promise(r => { img.onload = r; img.src = ld.data; });
                ctx.drawImage(img, 0, 0);
                layers.push({ name: ld.name, visible: ld.visible, opacity: ld.opacity, canvas });
            }
            activeLayerIdx = Math.max(0, layers.length - 1);
            renderLayers();
            renderLayerList();
            document.getElementById('docTitle').textContent = p.title || 'Untitled Drawing';
        } else {
            addLayer('Background', true);
            renderLayers();
        }

        fitCanvas();
        updateToolSettings();
        pushUndo();
        window.addEventListener('resize', fitCanvas);
    }

    initLoader();
<<<<<<< HEAD
=======
=======
    fitCanvas();
    updateToolSettings();
    pushUndo();
    window.addEventListener('resize', fitCanvas);
>>>>>>> 08e2c62dffa3f4807420f6dac59af6bc096bbbc8
>>>>>>> f6f03b8de292ccbe41060c48ead3853a01af4149
});
