// DOM要素 - クロップ
const dropZone = document.getElementById('drop-zone');
const dropMessage = document.querySelector('.drop-message');
const canvasWrapper = document.getElementById('canvas-wrapper');
const canvasContainer = document.getElementById('canvas-container');
const mainCanvas = document.getElementById('main-canvas');
const cropOverlay = document.getElementById('crop-overlay');
const previewSection = document.getElementById('preview-section');
const previewCanvas = document.getElementById('preview-canvas');
const previewInfo = document.getElementById('preview-info');
const imageInfo = document.getElementById('image-info');

// DOM要素 - ICO閲覧
const icoDropZone = document.getElementById('ico-drop-zone');
const icoDropMessage = document.querySelector('.ico-drop-message');
const icoGrid = document.getElementById('ico-grid');
const icoInfo = document.getElementById('ico-info');

// タブ
const tabButtons = document.querySelectorAll('.tab-btn');
const cropTab = document.getElementById('crop-tab');
const icoViewerTab = document.getElementById('ico-viewer-tab');
const cropView = document.getElementById('crop-view');
const icoView = document.getElementById('ico-view');

// ボタン
const openBtn = document.getElementById('open-btn');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');
const saveIconPngsBtn = document.getElementById('save-icon-pngs');
const openIcoBtn = document.getElementById('open-ico-btn');

// ズームコントロール
const zoomSlider = document.getElementById('zoom-slider');
const zoomDisplay = document.getElementById('zoom-display');
const zoomFitBtn = document.getElementById('zoom-fit');
const zoom100Btn = document.getElementById('zoom-100');

// 設定要素
const modeRadios = document.querySelectorAll('input[name="mode"]');
const centerOptions = document.getElementById('center-options');
const fixedOptions = document.getElementById('fixed-options');
const centerSizeSlider = document.getElementById('center-size');
const centerSizeDisplay = document.getElementById('center-size-display');
const fixedWidthInput = document.getElementById('fixed-width');
const fixedHeightInput = document.getElementById('fixed-height');
const lockRatioCheckbox = document.getElementById('lock-ratio');
const saveFormatSelect = document.getElementById('save-format');
const saveAsIconCheckbox = document.getElementById('save-as-icon');
const iconOptions = document.getElementById('icon-options');

// 角丸コントロール
const enableCornerRadiusCheckbox = document.getElementById('enable-corner-radius');
const cornerRadiusOptions = document.getElementById('corner-radius-options');
const cornerRadiusSlider = document.getElementById('corner-radius');
const cornerRadiusDisplay = document.getElementById('corner-radius-display');
const radiusPresetButtons = document.querySelectorAll('.radius-presets button');

// 状態
let originalImage = null;
let currentMode = 'center';
let currentTab = 'crop';
let cornerRadius = 0; // 0-50%

// クロップ領域（実際の画像座標）
let cropRect = { x: 0, y: 0, width: 0, height: 0 };

// 表示制御
let zoom = 1;           // 現在のズーム率
let fitScale = 1;       // フィット時のスケール
let panX = 0;           // パン位置X
let panY = 0;           // パン位置Y

// ドラッグ状態
let isDraggingCrop = false;
let isResizing = false;
let isPanning = false;
let resizeHandle = null;
let dragStart = { x: 0, y: 0 };
let cropStart = { x: 0, y: 0, width: 0, height: 0 };
let panStart = { x: 0, y: 0 };

const ctx = mainCanvas.getContext('2d');
const previewCtx = previewCanvas.getContext('2d');

// 初期化
function init() {
  setupEventListeners();
  createResizeHandles();
}

function setupEventListeners() {
  // タブ切り替え
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ドラッグ&ドロップ（クロップ）
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleDrop);

  // ドラッグ&ドロップ（ICO）
  icoDropZone.addEventListener('dragover', handleIcoDragOver);
  icoDropZone.addEventListener('dragleave', handleIcoDragLeave);
  icoDropZone.addEventListener('drop', handleIcoDrop);

  // ボタン
  openBtn.addEventListener('click', openFile);
  saveBtn.addEventListener('click', saveImage);
  resetBtn.addEventListener('click', resetCrop);
  saveIconPngsBtn.addEventListener('click', saveIconPngs);
  openIcoBtn.addEventListener('click', openIcoFile);

  // ズームコントロール
  zoomSlider.addEventListener('input', handleZoomSlider);
  zoomFitBtn.addEventListener('click', zoomToFit);
  zoom100Btn.addEventListener('click', zoomTo100);

  // モード切替
  modeRadios.forEach(radio => {
    radio.addEventListener('change', handleModeChange);
  });

  // 中心クロップスライダー
  centerSizeSlider.addEventListener('input', () => {
    centerSizeDisplay.textContent = `${centerSizeSlider.value}%`;
    if (originalImage && currentMode === 'center') {
      updateCenterCrop();
    }
  });

  // 固定サイズ入力
  fixedWidthInput.addEventListener('input', handleFixedSizeChange);
  fixedHeightInput.addEventListener('input', handleFixedSizeChange);

  // アイコン保存オプション
  saveAsIconCheckbox.addEventListener('change', () => {
    iconOptions.style.display = saveAsIconCheckbox.checked ? 'block' : 'none';
  });

  // 角丸オプション
  enableCornerRadiusCheckbox.addEventListener('change', () => {
    cornerRadiusOptions.style.display = enableCornerRadiusCheckbox.checked ? 'block' : 'none';
    cornerRadius = enableCornerRadiusCheckbox.checked ? parseInt(cornerRadiusSlider.value) : 0;
    updatePreview();
  });

  cornerRadiusSlider.addEventListener('input', () => {
    cornerRadius = parseInt(cornerRadiusSlider.value);
    cornerRadiusDisplay.textContent = cornerRadius === 50 ? '円形' : `${cornerRadius}%`;
    updatePreview();
  });

  radiusPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const radius = parseInt(btn.dataset.radius);
      cornerRadiusSlider.value = radius;
      cornerRadius = radius;
      cornerRadiusDisplay.textContent = radius === 50 ? '円形' : `${radius}%`;
      updatePreview();
    });
  });

  // マウスイベント（キャンバスラッパー）
  canvasWrapper.addEventListener('mousedown', handleCanvasMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // マウスホイールでズーム
  canvasWrapper.addEventListener('wheel', handleWheel, { passive: false });

  // クロップオーバーレイのドラッグ
  cropOverlay.addEventListener('mousedown', startCropDrag);
}

function createResizeHandles() {
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  handles.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    handle.dataset.handle = pos;
    handle.addEventListener('mousedown', startResize);
    cropOverlay.appendChild(handle);
  });
}

// タブ切り替え
function switchTab(tab) {
  currentTab = tab;
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  cropTab.classList.toggle('active', tab === 'crop');
  icoViewerTab.classList.toggle('active', tab === 'ico-viewer');
  cropView.style.display = tab === 'crop' ? 'flex' : 'none';
  icoView.style.display = tab === 'ico-viewer' ? 'flex' : 'none';
}

// ドラッグ&ドロップ（クロップ）
function handleDragOver(e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
}

function handleDragLeave() {
  dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImageFromFile(file);
  }
}

// ドラッグ&ドロップ（ICO）
function handleIcoDragOver(e) {
  e.preventDefault();
  icoDropZone.classList.add('drag-over');
}

function handleIcoDragLeave() {
  icoDropZone.classList.remove('drag-over');
}

function handleIcoDrop(e) {
  e.preventDefault();
  icoDropZone.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith('.ico')) {
    loadIcoFromFile(file);
  }
}

// ファイル読み込み
async function openFile() {
  const result = await window.electronAPI.openFile();
  if (result) {
    loadImageFromDataUrl(result.data, result.path);
  }
}

function loadImageFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    loadImageFromDataUrl(e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function loadImageFromDataUrl(dataUrl, fileName) {
  const img = new Image();
  img.onload = () => {
    originalImage = img;
    displayImage();
    saveBtn.disabled = false;
    resetBtn.disabled = false;
    imageInfo.innerHTML = `
      <strong>ファイル:</strong> ${fileName.split(/[/\\]/).pop()}<br>
      <strong>サイズ:</strong> ${img.width} x ${img.height}px
    `;
  };
  img.src = dataUrl;
}

// ICOファイル読み込み
async function openIcoFile() {
  const result = await window.electronAPI.openIco();
  if (result) {
    displayIcoImages(result.images, result.path);
  }
}

function loadIcoFromFile(file) {
  // FileReaderでICOファイルを読み込み、ArrayBufferとして処理
  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target.result;
    const result = await window.electronAPI.parseIcoBuffer(arrayBuffer, file.name);
    if (result) {
      displayIcoImages(result.images, file.name);
    }
  };
  reader.readAsArrayBuffer(file);
}

function displayIcoImages(images, filePath) {
  icoDropMessage.style.display = 'none';
  icoGrid.style.display = 'flex';
  icoGrid.innerHTML = '';

  icoInfo.innerHTML = `
    <strong>ファイル:</strong> ${filePath.split(/[/\\]/).pop()}<br>
    <strong>含まれる画像:</strong> ${images.length}個
  `;

  images.forEach(img => {
    const item = document.createElement('div');
    item.className = 'ico-item';

    const preview = document.createElement('div');
    preview.className = 'ico-item-preview';

    const imgEl = document.createElement('img');
    imgEl.src = img.data;
    imgEl.alt = `${img.width}x${img.height}`;
    preview.appendChild(imgEl);

    const info = document.createElement('div');
    info.className = 'ico-item-info';
    info.innerHTML = `
      <strong>${img.width} x ${img.height}</strong>
      ${img.bitCount}bit / ${formatBytes(img.size)}
    `;

    const actions = document.createElement('div');
    actions.className = 'ico-item-actions';

    const extractBtn = document.createElement('button');
    extractBtn.className = 'btn btn-secondary';
    extractBtn.textContent = 'PNG保存';
    extractBtn.addEventListener('click', () => extractIcoImage(img));
    actions.appendChild(extractBtn);

    item.appendChild(preview);
    item.appendChild(info);
    item.appendChild(actions);
    icoGrid.appendChild(item);
  });
}

async function extractIcoImage(img) {
  const result = await window.electronAPI.extractIcoImage({
    imageData: img.data,
    width: img.width,
    height: img.height
  });

  if (result.success) {
    alert(`保存しました: ${result.path}`);
  } else if (result.error) {
    alert(`エラー: ${result.error}`);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 画像表示
function displayImage() {
  const wrapperRect = dropZone.getBoundingClientRect();
  const maxWidth = wrapperRect.width - 40;
  const maxHeight = wrapperRect.height - 40;

  // フィットスケールを計算
  fitScale = Math.min(
    maxWidth / originalImage.width,
    maxHeight / originalImage.height,
    1
  );

  // 初期表示はフィット
  zoom = fitScale;
  updateZoomDisplay();

  // キャンバスサイズ設定（実際の画像サイズ）
  mainCanvas.width = originalImage.width;
  mainCanvas.height = originalImage.height;
  ctx.drawImage(originalImage, 0, 0);

  // 表示
  dropMessage.style.display = 'none';
  canvasWrapper.style.display = 'block';
  previewSection.style.display = 'block';

  // 中央配置
  centerCanvas();

  // 初期クロップ領域設定
  initCropRect();
}

function centerCanvas() {
  const wrapperRect = dropZone.getBoundingClientRect();
  const displayWidth = originalImage.width * zoom;
  const displayHeight = originalImage.height * zoom;

  panX = (wrapperRect.width - displayWidth) / 2;
  panY = (wrapperRect.height - displayHeight) / 2;

  updateCanvasTransform();
}

function updateCanvasTransform() {
  canvasContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  updateOverlay();
}

function updateZoomDisplay() {
  const percent = Math.round(zoom * 100);
  zoomDisplay.textContent = `${percent}%`;
  zoomSlider.value = percent;
}

// ズーム操作
function handleZoomSlider() {
  const newZoom = parseInt(zoomSlider.value) / 100;
  zoomTo(newZoom);
}

function zoomToFit() {
  zoomTo(fitScale);
  centerCanvas();
}

function zoomTo100() {
  zoomTo(1);
  centerCanvas();
}

function zoomTo(newZoom) {
  zoom = Math.max(0.1, Math.min(5, newZoom));
  updateZoomDisplay();
  updateCanvasTransform();
}

function handleWheel(e) {
  if (!originalImage) return;
  e.preventDefault();

  const rect = canvasWrapper.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // ズーム前のマウス位置（画像座標）
  const imgX = (mouseX - panX) / zoom;
  const imgY = (mouseY - panY) / zoom;

  // ズーム変更
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.1, Math.min(5, zoom * delta));

  // マウス位置を中心にズーム
  panX = mouseX - imgX * newZoom;
  panY = mouseY - imgY * newZoom;

  zoom = newZoom;
  updateZoomDisplay();
  updateCanvasTransform();
}

// パン操作
function handleCanvasMouseDown(e) {
  if (!originalImage) return;

  // クロップオーバーレイ上でない場合はパン開始
  if (!e.target.closest('.crop-overlay')) {
    isPanning = true;
    panStart = { x: e.clientX - panX, y: e.clientY - panY };
    canvasWrapper.style.cursor = 'grabbing';
    e.preventDefault();
  }
}

// クロップ領域ドラッグ
function startCropDrag(e) {
  if (e.target.classList.contains('resize-handle')) return;

  // 中心クロップモードでは移動不可
  if (currentMode === 'center') return;

  isDraggingCrop = true;
  dragStart = { x: e.clientX, y: e.clientY };
  cropStart = { ...cropRect };
  e.preventDefault();
  e.stopPropagation();
}

function startResize(e) {
  if (currentMode === 'center') return;

  isResizing = true;
  resizeHandle = e.target.dataset.handle;
  dragStart = { x: e.clientX, y: e.clientY };
  cropStart = { ...cropRect };
  e.preventDefault();
  e.stopPropagation();
}

function handleMouseMove(e) {
  if (isPanning) {
    panX = e.clientX - panStart.x;
    panY = e.clientY - panStart.y;
    updateCanvasTransform();
  } else if (isDraggingCrop) {
    handleCropDrag(e);
  } else if (isResizing) {
    handleResize(e);
  }
}

function handleCropDrag(e) {
  const dx = (e.clientX - dragStart.x) / zoom;
  const dy = (e.clientY - dragStart.y) / zoom;

  cropRect.x = Math.max(0, Math.min(originalImage.width - cropRect.width, cropStart.x + dx));
  cropRect.y = Math.max(0, Math.min(originalImage.height - cropRect.height, cropStart.y + dy));

  updateOverlay();
  updatePreview();
}

function handleResize(e) {
  const dx = (e.clientX - dragStart.x) / zoom;
  const dy = (e.clientY - dragStart.y) / zoom;

  let newRect = { ...cropStart };

  // 1:1比率維持
  const maintainRatio = currentMode === 'center' ||
    (currentMode === 'fixed' && lockRatioCheckbox.checked);

  switch (resizeHandle) {
    case 'se':
      newRect.width = cropStart.width + dx;
      newRect.height = maintainRatio ? newRect.width : cropStart.height + dy;
      break;
    case 'sw':
      newRect.width = cropStart.width - dx;
      newRect.x = cropStart.x + dx;
      newRect.height = maintainRatio ? newRect.width : cropStart.height + dy;
      break;
    case 'ne':
      newRect.width = cropStart.width + dx;
      newRect.height = maintainRatio ? newRect.width : cropStart.height - dy;
      newRect.y = maintainRatio ? cropStart.y - (newRect.height - cropStart.height) : cropStart.y + dy;
      break;
    case 'nw':
      newRect.width = cropStart.width - dx;
      newRect.height = maintainRatio ? newRect.width : cropStart.height - dy;
      newRect.x = cropStart.x + dx;
      newRect.y = maintainRatio ? cropStart.y - (newRect.height - cropStart.height) : cropStart.y + dy;
      break;
    case 'n':
      newRect.height = cropStart.height - dy;
      newRect.y = cropStart.y + dy;
      if (maintainRatio) {
        newRect.width = newRect.height;
        newRect.x = cropStart.x + (cropStart.width - newRect.width) / 2;
      }
      break;
    case 's':
      newRect.height = cropStart.height + dy;
      if (maintainRatio) {
        newRect.width = newRect.height;
        newRect.x = cropStart.x + (cropStart.width - newRect.width) / 2;
      }
      break;
    case 'e':
      newRect.width = cropStart.width + dx;
      if (maintainRatio) {
        newRect.height = newRect.width;
        newRect.y = cropStart.y + (cropStart.height - newRect.height) / 2;
      }
      break;
    case 'w':
      newRect.width = cropStart.width - dx;
      newRect.x = cropStart.x + dx;
      if (maintainRatio) {
        newRect.height = newRect.width;
        newRect.y = cropStart.y + (cropStart.height - newRect.height) / 2;
      }
      break;
  }

  // 最小サイズ制限
  const minSize = 10;
  if (newRect.width >= minSize && newRect.height >= minSize) {
    // 境界チェック
    newRect.x = Math.max(0, newRect.x);
    newRect.y = Math.max(0, newRect.y);
    if (newRect.x + newRect.width > originalImage.width) {
      newRect.width = originalImage.width - newRect.x;
      if (maintainRatio) newRect.height = newRect.width;
    }
    if (newRect.y + newRect.height > originalImage.height) {
      newRect.height = originalImage.height - newRect.y;
      if (maintainRatio) newRect.width = newRect.height;
    }

    cropRect = newRect;
    updateOverlay();
    updatePreview();
  }
}

function handleMouseUp() {
  if (isPanning) {
    canvasWrapper.style.cursor = 'grab';
  }
  isPanning = false;
  isDraggingCrop = false;
  isResizing = false;
  resizeHandle = null;
}

// クロップ領域初期化
function initCropRect() {
  if (currentMode === 'center') {
    updateCenterCrop();
  } else if (currentMode === 'fixed') {
    updateFixedCrop();
  } else {
    // フリーモード: 画像全体を選択
    cropRect = {
      x: 0,
      y: 0,
      width: originalImage.width,
      height: originalImage.height
    };
  }
  updateOverlay();
  updatePreview();
}

function updateCenterCrop() {
  const size = parseInt(centerSizeSlider.value) / 100;
  const minDim = Math.min(originalImage.width, originalImage.height);
  const cropSize = minDim * size;

  cropRect = {
    x: (originalImage.width - cropSize) / 2,
    y: (originalImage.height - cropSize) / 2,
    width: cropSize,
    height: cropSize
  };
  updateOverlay();
  updatePreview();
}

function updateFixedCrop() {
  const targetWidth = parseInt(fixedWidthInput.value) || 256;
  const targetHeight = parseInt(fixedHeightInput.value) || 256;

  // 画像サイズを超えないように
  const cropWidth = Math.min(targetWidth, originalImage.width);
  const cropHeight = Math.min(targetHeight, originalImage.height);

  cropRect = {
    x: (originalImage.width - cropWidth) / 2,
    y: (originalImage.height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight
  };
  updateOverlay();
  updatePreview();
}

function handleFixedSizeChange(e) {
  if (lockRatioCheckbox.checked && originalImage) {
    const ratio = originalImage.width / originalImage.height;
    if (e.target === fixedWidthInput) {
      fixedHeightInput.value = Math.round(parseInt(fixedWidthInput.value) / ratio);
    } else {
      fixedWidthInput.value = Math.round(parseInt(fixedHeightInput.value) * ratio);
    }
  }
  if (currentMode === 'fixed') {
    updateFixedCrop();
  }
}

// オーバーレイ更新
function updateOverlay() {
  if (!originalImage) return;

  // canvasContainerにtransform: scale(zoom)が適用されているため、
  // オーバーレイの座標は実際の画像座標をそのまま使用する
  cropOverlay.style.left = `${cropRect.x}px`;
  cropOverlay.style.top = `${cropRect.y}px`;
  cropOverlay.style.width = `${cropRect.width}px`;
  cropOverlay.style.height = `${cropRect.height}px`;
  cropOverlay.style.display = 'block';

  // 中心クロップモードでは移動・リサイズ不可
  if (currentMode === 'center') {
    cropOverlay.classList.add('no-drag');
  } else {
    cropOverlay.classList.remove('no-drag');
  }

  // リサイズハンドルの表示制御
  const handles = cropOverlay.querySelectorAll('.resize-handle');
  handles.forEach(handle => {
    handle.style.display = currentMode === 'center' ? 'none' : 'block';
  });
}

// プレビュー更新
function updatePreview() {
  if (!originalImage) return;

  // プレビューサイズ
  const previewSize = 200;
  const previewScale = Math.min(previewSize / cropRect.width, previewSize / cropRect.height);
  const pw = cropRect.width * previewScale;
  const ph = cropRect.height * previewScale;

  previewCanvas.width = pw;
  previewCanvas.height = ph;

  previewCtx.clearRect(0, 0, pw, ph);

  // 角丸クリッピング
  if (cornerRadius > 0) {
    const radius = (Math.min(pw, ph) / 2) * (cornerRadius / 50);
    previewCtx.beginPath();
    roundRect(previewCtx, 0, 0, pw, ph, radius);
    previewCtx.clip();
  }

  previewCtx.drawImage(
    originalImage,
    cropRect.x, cropRect.y, cropRect.width, cropRect.height,
    0, 0, pw, ph
  );

  previewInfo.textContent = `出力サイズ: ${Math.round(cropRect.width)} x ${Math.round(cropRect.height)}px`;
}

// 角丸矩形パスを描画
function roundRect(ctx, x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 角丸を適用した画像を生成
function createCroppedCanvas() {
  // 座標を整数に丸める（小数点があると描画がずれる）
  const x = Math.round(cropRect.x);
  const y = Math.round(cropRect.y);
  const width = Math.round(cropRect.width);
  const height = Math.round(cropRect.height);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');

  // 角丸クリッピング
  if (cornerRadius > 0) {
    const radius = (Math.min(width, height) / 2) * (cornerRadius / 50);
    tempCtx.beginPath();
    roundRect(tempCtx, 0, 0, width, height, radius);
    tempCtx.clip();
  }

  tempCtx.drawImage(
    originalImage,
    x, y, width, height,
    0, 0, width, height
  );

  return tempCanvas;
}

// モード切替
function handleModeChange(e) {
  currentMode = e.target.value;

  centerOptions.style.display = currentMode === 'center' ? 'block' : 'none';
  fixedOptions.style.display = currentMode === 'fixed' ? 'block' : 'none';

  // カーソル更新
  if (currentMode === 'center') {
    canvasWrapper.classList.remove('crop-mode');
  } else {
    canvasWrapper.classList.add('crop-mode');
  }

  if (originalImage) {
    initCropRect();
  }
}

// リセット
function resetCrop() {
  if (originalImage) {
    zoomToFit();
    initCropRect();
  }
}

// 保存
async function saveImage() {
  if (!originalImage) return;

  // クロップされた画像を作成（角丸適用）
  const tempCanvas = createCroppedCanvas();
  const imageData = tempCanvas.toDataURL('image/png');

  if (saveAsIconCheckbox.checked) {
    // アイコンとして保存
    const sizes = getSelectedIconSizes();
    if (sizes.length === 0) {
      alert('少なくとも1つのサイズを選択してください');
      return;
    }

    const result = await window.electronAPI.saveIcon({ imageData, sizes });
    if (result.success) {
      alert(`アイコンを保存しました: ${result.path}`);
    } else if (result.error) {
      alert(`エラー: ${result.error}`);
    }
  } else {
    // 通常の画像として保存
    const format = saveFormatSelect.value;
    const result = await window.electronAPI.saveImage({ imageData, format });
    if (result.success) {
      alert(`画像を保存しました: ${result.path}`);
    } else if (result.error) {
      alert(`エラー: ${result.error}`);
    }
  }
}

async function saveIconPngs() {
  if (!originalImage) return;

  // クロップされた画像を作成（角丸適用）
  const tempCanvas = createCroppedCanvas();
  const imageData = tempCanvas.toDataURL('image/png');
  const sizes = getSelectedIconSizes();

  if (sizes.length === 0) {
    alert('少なくとも1つのサイズを選択してください');
    return;
  }

  const result = await window.electronAPI.saveIconPngs({ imageData, sizes });
  if (result.success) {
    alert(`${result.files.length}個のPNGファイルを保存しました`);
  } else if (result.error) {
    alert(`エラー: ${result.error}`);
  }
}

function getSelectedIconSizes() {
  const checkboxes = document.querySelectorAll('#icon-options input[data-size]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.dataset.size)).sort((a, b) => a - b);
}

// 起動
init();
