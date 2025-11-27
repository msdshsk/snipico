const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ファイル選択ダイアログ（画像用）
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }
    ]
  });

  if (result.canceled) return null;

  const filePath = result.filePaths[0];
  const imageBuffer = fs.readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeType = ext === 'jpg' ? 'jpeg' : ext;

  return {
    path: filePath,
    data: `data:image/${mimeType};base64,${base64}`
  };
});

// ICOファイル選択ダイアログ
ipcMain.handle('open-ico', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Icon Files', extensions: ['ico'] }
    ]
  });

  if (result.canceled) return null;

  const filePath = result.filePaths[0];
  const icoBuffer = fs.readFileSync(filePath);

  // ICOファイルをパースして各サイズの画像を抽出
  const images = await parseIco(icoBuffer);

  return {
    path: filePath,
    images: images
  };
});

// D&DされたICOファイルのパース（ArrayBufferから）
ipcMain.handle('parse-ico-buffer', async (event, { arrayBuffer, fileName }) => {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const images = await parseIco(buffer);
    return {
      path: fileName,
      images: images
    };
  } catch (error) {
    console.error('Failed to parse ICO:', error);
    return null;
  }
});

// ICOファイルのパース
async function parseIco(buffer) {
  const images = [];

  // ICOヘッダー読み取り
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);

  if (type !== 1) {
    throw new Error('Not a valid ICO file');
  }

  // 各エントリを読み取り
  for (let i = 0; i < count; i++) {
    const entryOffset = 6 + (i * 16);

    let width = buffer.readUInt8(entryOffset);
    let height = buffer.readUInt8(entryOffset + 1);
    const colorCount = buffer.readUInt8(entryOffset + 2);
    const reserved2 = buffer.readUInt8(entryOffset + 3);
    const planes = buffer.readUInt16LE(entryOffset + 4);
    const bitCount = buffer.readUInt16LE(entryOffset + 6);
    const bytesInRes = buffer.readUInt32LE(entryOffset + 8);
    const imageOffset = buffer.readUInt32LE(entryOffset + 12);

    // 0は256を意味する
    if (width === 0) width = 256;
    if (height === 0) height = 256;

    // 画像データを抽出
    const imageData = buffer.slice(imageOffset, imageOffset + bytesInRes);

    // PNGかBMPかを判定
    const isPng = imageData[0] === 0x89 && imageData[1] === 0x50 &&
                  imageData[2] === 0x4E && imageData[3] === 0x47;

    let base64Data;
    if (isPng) {
      base64Data = `data:image/png;base64,${imageData.toString('base64')}`;
    } else {
      // BMPデータをPNGに変換
      try {
        const pngBuffer = await sharp(imageData, { raw: { width, height, channels: 4 } })
          .png()
          .toBuffer();
        base64Data = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      } catch (e) {
        // sharpで直接読めない場合はBMPとして処理を試みる
        try {
          // ICO内のBMPはヘッダーが省略されているため、再構築が必要
          const pngBuffer = await convertIcoBmpToPng(imageData, width, height, bitCount);
          base64Data = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        } catch (e2) {
          console.error('Failed to convert BMP:', e2);
          continue;
        }
      }
    }

    images.push({
      width,
      height,
      bitCount,
      size: bytesInRes,
      data: base64Data
    });
  }

  return images;
}

// ICO内のBMPをPNGに変換
async function convertIcoBmpToPng(bmpData, width, height, bitCount) {
  // ICO内のBMPはDIBフォーマット（ヘッダーのみ、ファイルヘッダーなし）
  // かつ、XORマスクとANDマスクが含まれる

  const headerSize = bmpData.readUInt32LE(0);
  const bmpWidth = bmpData.readInt32LE(4);
  const bmpHeight = bmpData.readInt32LE(8); // 通常は高さの2倍（XOR + ANDマスク）
  const bmpBitCount = bmpData.readUInt16LE(14);

  const actualHeight = Math.abs(bmpHeight) / 2; // ANDマスク分を除く
  const rowSize = Math.ceil((width * bmpBitCount) / 32) * 4;
  const pixelDataOffset = headerSize;

  // RGBA データを作成
  const rgba = Buffer.alloc(width * height * 4);

  if (bmpBitCount === 32) {
    // 32bit BGRA
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcOffset = pixelDataOffset + (height - 1 - y) * rowSize + x * 4;
        const dstOffset = (y * width + x) * 4;

        rgba[dstOffset] = bmpData[srcOffset + 2];     // R
        rgba[dstOffset + 1] = bmpData[srcOffset + 1]; // G
        rgba[dstOffset + 2] = bmpData[srcOffset];     // B
        rgba[dstOffset + 3] = bmpData[srcOffset + 3]; // A
      }
    }
  } else if (bmpBitCount === 24) {
    // 24bit BGR + ANDマスク
    const andMaskOffset = pixelDataOffset + rowSize * height;
    const andRowSize = Math.ceil(width / 32) * 4;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcOffset = pixelDataOffset + (height - 1 - y) * rowSize + x * 3;
        const dstOffset = (y * width + x) * 4;

        rgba[dstOffset] = bmpData[srcOffset + 2];     // R
        rgba[dstOffset + 1] = bmpData[srcOffset + 1]; // G
        rgba[dstOffset + 2] = bmpData[srcOffset];     // B

        // ANDマスクからアルファを取得
        const andByteOffset = andMaskOffset + (height - 1 - y) * andRowSize + Math.floor(x / 8);
        const andBit = 7 - (x % 8);
        const isTransparent = (bmpData[andByteOffset] >> andBit) & 1;
        rgba[dstOffset + 3] = isTransparent ? 0 : 255;
      }
    }
  }

  return await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

// 画像保存（通常）
ipcMain.handle('save-image', async (event, { imageData, format }) => {
  const filters = {
    png: { name: 'PNG Image', extensions: ['png'] },
    jpg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
    webp: { name: 'WebP Image', extensions: ['webp'] }
  };

  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [filters[format] || filters.png]
  });

  if (result.canceled) return { success: false };

  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    let outputBuffer;
    if (format === 'jpg') {
      outputBuffer = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
    } else if (format === 'webp') {
      outputBuffer = await sharp(buffer).webp({ quality: 95 }).toBuffer();
    } else {
      outputBuffer = await sharp(buffer).png().toBuffer();
    }

    fs.writeFileSync(result.filePath, outputBuffer);
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 自前でICOファイルを生成
function createIcoBuffer(pngBuffers, sizes) {
  // ICOファイルフォーマット:
  // - ICONDIR (6 bytes)
  // - ICONDIRENTRY[] (16 bytes each)
  // - Image data (PNG buffers)

  const numImages = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + (entrySize * numImages);

  // 全体のサイズを計算
  let totalSize = dataOffset;
  for (const png of pngBuffers) {
    totalSize += png.length;
  }

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // ICONDIR header
  buffer.writeUInt16LE(0, offset);      // Reserved (must be 0)
  offset += 2;
  buffer.writeUInt16LE(1, offset);      // Type (1 = ICO)
  offset += 2;
  buffer.writeUInt16LE(numImages, offset); // Number of images
  offset += 2;

  // ICONDIRENTRY for each image
  let imageOffset = dataOffset;
  for (let i = 0; i < numImages; i++) {
    const size = sizes[i];
    const pngBuffer = pngBuffers[i];

    // Width (0 means 256)
    buffer.writeUInt8(size >= 256 ? 0 : size, offset);
    offset += 1;
    // Height (0 means 256)
    buffer.writeUInt8(size >= 256 ? 0 : size, offset);
    offset += 1;
    // Color palette (0 = no palette)
    buffer.writeUInt8(0, offset);
    offset += 1;
    // Reserved (must be 0)
    buffer.writeUInt8(0, offset);
    offset += 1;
    // Color planes (1 for ICO)
    buffer.writeUInt16LE(1, offset);
    offset += 2;
    // Bits per pixel (32 for RGBA PNG)
    buffer.writeUInt16LE(32, offset);
    offset += 2;
    // Size of image data
    buffer.writeUInt32LE(pngBuffer.length, offset);
    offset += 4;
    // Offset to image data
    buffer.writeUInt32LE(imageOffset, offset);
    offset += 4;

    imageOffset += pngBuffer.length;
  }

  // Write image data
  for (const pngBuffer of pngBuffers) {
    pngBuffer.copy(buffer, offset);
    offset += pngBuffer.length;
  }

  return buffer;
}

// マルチサイズアイコン保存（Windows ICO）
ipcMain.handle('save-icon', async (event, { imageData, sizes }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Icon File', extensions: ['ico'] }]
  });

  if (result.canceled) return { success: false };

  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // サイズでソート（小さい順）
    const sortedSizes = [...sizes].sort((a, b) => a - b);

    // 各サイズのPNGを生成
    const pngBuffers = [];
    for (const size of sortedSizes) {
      const pngBuffer = await sharp(buffer)
        .resize(size, size, {
          fit: 'fill',
          kernel: 'lanczos3'
        })
        .png()
        .toBuffer();
      pngBuffers.push(pngBuffer);
    }

    // ICOに変換
    const icoBuffer = createIcoBuffer(pngBuffers, sortedSizes);
    fs.writeFileSync(result.filePath, icoBuffer);

    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 個別サイズのPNG保存（複数ファイル）
ipcMain.handle('save-icon-pngs', async (event, { imageData, sizes }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'アイコン保存先フォルダを選択'
  });

  if (result.canceled) return { success: false };

  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const outputDir = result.filePaths[0];

    const savedFiles = [];
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon_${size}x${size}.png`);
      await sharp(buffer)
        .resize(size, size, {
          fit: 'fill',
          kernel: 'lanczos3'
        })
        .png()
        .toFile(outputPath);
      savedFiles.push(outputPath);
    }

    return { success: true, files: savedFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ICOから特定サイズの画像を抽出して保存
ipcMain.handle('extract-ico-image', async (event, { imageData, width, height }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `icon_${width}x${height}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });

  if (result.canceled) return { success: false };

  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
