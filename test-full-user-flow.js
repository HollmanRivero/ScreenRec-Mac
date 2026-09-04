const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')

let selectedSourceId = null
let cachedSources = []
let sourcesLock = false

async function fetchSources() {
  if (sourcesLock) return cachedSources
  sourcesLock = true
  try {
    cachedSources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false
    })
  } catch (err) {
    try {
      cachedSources = await desktopCapturer.getSources({ types: ['screen'] })
    } catch {}
  } finally {
    sourcesLock = false
  }
  return cachedSources
}

app.whenReady().then(async () => {
  console.log('--- TESTING FULL USER FLOW INTERACTION ---')

  const win = new BrowserWindow({
    width: 960,
    height: 680,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.webContents.on('console-message', (event, level, message) => {
    console.log(`[RENDERER LOG]: ${message}`)
  })

  win.webContents.session.setPermissionRequestHandler((w, p, cb) => cb(true))
  win.webContents.session.setPermissionCheckHandler(() => true)

  win.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = cachedSources.length > 0 ? cachedSources : await fetchSources()
      const source = (selectedSourceId ? sources.find(s => s.id === selectedSourceId) : null)
        || sources.find(s => s.id.startsWith('screen:'))
        || sources[0]
      if (!source) return callback({})
      callback({ video: source })
    } catch (e) {
      console.error('[MAIN setDisplayMediaRequestHandler error]:', e)
      callback({})
    }
  }, { useSystemPicker: false })

  ipcMain.handle('set-source-id', (_, id) => {
    selectedSourceId = id
    return true
  })

  ipcMain.handle('get-sources', async () => {
    const sources = await fetchSources()
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      type: s.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : ''
    }))
  })

  ipcMain.handle('check-permissions', async () => ({ screen: 'granted', camera: 'granted', mic: 'granted' }))
  ipcMain.handle('request-media-access', async () => true)

  const licenseManager = require('./license-manager')
  ipcMain.handle('get-license-status', () => licenseManager.getStatus())
  ipcMain.handle('activate-license-key', (_, key) => licenseManager.activate(key))
  ipcMain.handle('tick-trial', (_, seconds) => licenseManager.tickTrial(seconds))
  ipcMain.handle('open-payment-link', (_, provider) => licenseManager.openPayment(provider))
  ipcMain.handle('start-paypal-checkout', async () => {
    const activation = licenseManager.generateAndActivateKey()
    return { success: true, licenseKey: activation.key, orderId: 'MOCK-SANDBOX-12345', status: licenseManager.getStatus() }
  })

  const { execFile } = require('child_process')
  const os = require('os')
  function getFFmpegPath() {
    try {
      let p = require('ffmpeg-static')
      if (p && fs.existsSync(p)) return p
    } catch (e) {}
    return 'ffmpeg'
  }

  ipcMain.handle('save-recording', async (e, { buffer, format }) => {
    console.log('[MAIN save-recording called] buffer size:', buffer.byteLength, 'format:', format)
    const ext = (format || 'mp4').toLowerCase()
    const ts = Date.now()
    const tmpWebm = path.join(os.tmpdir(), `screenrec-src-${ts}.webm`)
    const tmpOut = path.join(os.tmpdir(), `screenrec-test-${ts}.${ext}`)
    const filePath = path.join(os.tmpdir(), `test-saved-rec.${ext}`)
    fs.writeFileSync(tmpWebm, Buffer.from(buffer))

    const isMac = process.platform === 'darwin'
    const useVideoToolbox = isMac && (ext === 'mp4' || ext === 'mov')
    const ffmpegArgs = ['-i', tmpWebm]
    if (useVideoToolbox) {
      ffmpegArgs.push('-c:v', 'h264_videotoolbox', '-b:v', '6000k', '-pix_fmt', 'yuv420p')
    } else {
      ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p')
    }
    ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', tmpOut)

    return new Promise((resolve) => {
      execFile(getFFmpegPath(), ffmpegArgs, (err, stdout, stderr) => {
        try { fs.unlinkSync(tmpWebm) } catch {}
        if (err) {
          console.error('Real test save error:', stderr || err.message)
          resolve({ success: false, error: stderr || err.message })
        } else {
          try {
            fs.copyFileSync(tmpOut, filePath)
            fs.unlinkSync(tmpOut)
            const s = fs.statSync(filePath)
            console.log('[REAL CONVERSION SUCCEEDED] Saved MP4 path:', filePath, 'size:', s.size)
            resolve({ success: true, filePath })
          } catch (cErr) {
            resolve({ success: false, error: cErr.message })
          }
        }
      })
    })
  })

  await fetchSources()
  await win.loadFile(path.join(__dirname, 'index.html'))
  await new Promise(resolve => setTimeout(resolve, 1500))

  // Step 1: Test Refresh Button Click
  console.log('1. Testing Refresh Button Click...')
  await win.webContents.executeJavaScript(`document.getElementById('btn-refresh').click()`)
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Step 2: Test clicking "Vinduer" tab
  console.log('2. Testing Vinduer Tab Filter...')
  const windowsTabResult = await win.webContents.executeJavaScript(`
    (() => {
      document.querySelector('.source-tab[data-filter="window"]').click();
      const visibleItems = Array.from(document.querySelectorAll('.source-item')).map(el => ({
        id: el.dataset.id,
        name: el.querySelector('.source-name')?.textContent
      }));
      return { activeFilter: currentFilter, visibleCount: visibleItems.length, visibleItems: visibleItems };
    })()
  `)
  console.log('Vinduer Tab result:', JSON.stringify(windowsTabResult, null, 2))

  // Step 3: Test clicking "Skjermer" tab
  console.log('3. Testing Skjermer Tab Filter...')
  const screensTabResult = await win.webContents.executeJavaScript(`
    (() => {
      document.querySelector('.source-tab[data-filter="screen"]').click();
      const visibleItems = Array.from(document.querySelectorAll('.source-item')).map(el => ({
        id: el.dataset.id,
        name: el.querySelector('.source-name')?.textContent
      }));
      return { activeFilter: currentFilter, visibleCount: visibleItems.length, visibleItems: visibleItems };
    })()
  `)
  console.log('Skjermer Tab result:', JSON.stringify(screensTabResult, null, 2))

  // Step 4: Test selecting Bare Skjermen mode
  console.log('4. Testing "Bare Skjermen" Mode...')
  const selectScreenResult = await win.webContents.executeJavaScript(`
    (async () => {
      document.getElementById('btn-mode-screen').click();
      // Wait for stream to attach
      for (let i = 0; i < 20; i++) {
        if (screenStream && screenStream.active) break;
        await new Promise(r => setTimeout(r, 100));
      }
      const vid = document.getElementById('preview-screen');
      return {
        selectedSource: selectedSource?.name,
        hasSrcObject: !!vid.srcObject,
        videoTracks: vid.srcObject ? vid.srcObject.getVideoTracks().length : 0,
        status: document.getElementById('status')?.textContent
      };
    })()
  `)
  console.log('Bare Skjermen result:', JSON.stringify(selectScreenResult, null, 2))

  // Step 5: Test Recording Lifecycle
  console.log('5. Testing Start & Stop Recording Flow...')
  const recordingFlowResult = await win.webContents.executeJavaScript(`
    (async () => {
      toggleMic.checked = false; // Headless testing without mic hardware
      console.log('Clicking Start Recording...');
      await startRecording();
      
      // Verify recording is active
      const isRec = isRecording;
      const recState = mediaRecorder ? mediaRecorder.state : 'none';
      
      // Record for 2 seconds
      await new Promise(r => setTimeout(r, 2000));
      
      console.log('MediaRecorder state during recording:', mediaRecorder?.state, 'chunks count:', recordedChunks.length);
      
      console.log('Calling stopRecording()...');
      stopRecording();
      
      for (let i = 0; i < 60; i++) {
        const s = document.getElementById('status')?.textContent;
        if (s === 'Opptak lagret!') break;
        await new Promise(r => setTimeout(r, 200));
      }
      
      return {
        isRec,
        recState,
        chunksRecorded: recordedChunks.length,
        statusAfterStop: document.getElementById('status')?.textContent
      };
    })()
  `)
  console.log('Recording Flow result:', JSON.stringify(recordingFlowResult, null, 2))

  // Step 6: Test License Status and Key Activation
  console.log('6. Testing License System & Activation...')
  const licenseTestResult = await win.webContents.executeJavaScript(`
    (async () => {
      const initialStatus = await ipcRenderer.invoke('get-license-status');
      const testActivation = await ipcRenderer.invoke('activate-license-key', 'SCREC-HOLLMAN-PRO-2026');
      const updatedStatus = await ipcRenderer.invoke('get-license-status');
      return {
        initialStatus,
        activationResult: testActivation.success,
        activatedKey: testActivation.status?.licenseKey,
        isProNow: updatedStatus.isActivated
      };
    })()
  `)
  console.log('License System result:', JSON.stringify(licenseTestResult, null, 2))

  console.log('--- ALL INTERACTIVE TESTS COMPLETED ---')
  app.exit(0)
})
