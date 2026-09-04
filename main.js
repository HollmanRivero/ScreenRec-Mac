const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, systemPreferences, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFile } = require('child_process')
const licenseManager = require('./license-manager')
const paypalService = require('./paypal-service')

let mainWindow
let selectedSourceId = null
let cachedSources = []

// Resolves FFmpeg binary with resilient fallback paths
function getFFmpegPath() {
  try {
    let p = require('ffmpeg-static')
    if (p) {
      if (app && app.isPackaged) p = p.replace('app.asar', 'app.asar.unpacked')
      if (fs.existsSync(p)) return p
    }
  } catch (e) {}

  const fallbacks = ['/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg']
  for (const f of fallbacks) {
    if (f === 'ffmpeg' || fs.existsSync(f)) return f
  }
  return 'ffmpeg'
}

// Fetch all screen and window sources
async function getSourcesList() {
  try {
    cachedSources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false
    })
  } catch (err) {
    try {
      cachedSources = await desktopCapturer.getSources({ types: ['screen'] })
    } catch {
      cachedSources = []
    }
  }
  return cachedSources
}

async function createWindow() {
  // Pre-load sources BEFORE window creation so cache is immediately ready
  await getSourcesList()

  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    frame: false,
    transparent: false,
    resizable: true,
    minWidth: 850,
    minHeight: 580,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  })

  const ses = mainWindow.webContents.session
  if (ses.setPermissionRequestHandler) ses.setPermissionRequestHandler((w, p, cb) => cb(true))
  if (ses.setPermissionCheckHandler) ses.setPermissionCheckHandler(() => true)

  // Direct DisplayMedia request handler
  if (ses.setDisplayMediaRequestHandler) {
    ses.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        let sources = cachedSources
        if (!sources || sources.length === 0) {
          sources = await getSourcesList()
        }

        const source = (selectedSourceId ? sources.find(s => s.id === selectedSourceId) : null)
          || sources.find(s => s.id.startsWith('screen:'))
          || sources[0]

        if (!source) {
          console.error('setDisplayMediaRequestHandler: no source available')
          return callback({})
        }
        const streamConfig = { video: source }
        if (request && request.audioRequested) {
          streamConfig.audio = 'loopback'
        }
        callback(streamConfig)
      } catch (err) {
        console.error('setDisplayMediaRequestHandler error:', err)
        callback({})
      }
    }, { useSystemPicker: false })
  }

  mainWindow.loadFile('index.html')

  // Keyboard shortcut to toggle DevTools (Cmd+Option+I / F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (((input.control || input.meta) && input.alt && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    systemPreferences.askForMediaAccess('camera').catch(() => {})
    systemPreferences.askForMediaAccess('microphone').catch(() => {})
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  const sources = await getSourcesList()
  return sources.map(s => ({
    id: s.id,
    name: s.name || (s.id.startsWith('screen:') ? 'Skjerm ' + s.id : 'Vindu'),
    type: s.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : ''
  }))
})

ipcMain.handle('set-source-id', (_, id) => {
  selectedSourceId = id
  return true
})

ipcMain.handle('check-permissions', async () => {
  if (process.platform !== 'darwin') return { screen: 'granted', camera: 'granted', mic: 'granted' }
  try {
    return {
      screen: systemPreferences.getMediaAccessStatus ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
      camera: systemPreferences.getMediaAccessStatus ? systemPreferences.getMediaAccessStatus('camera') : 'granted',
      mic: systemPreferences.getMediaAccessStatus ? systemPreferences.getMediaAccessStatus('microphone') : 'granted'
    }
  } catch {
    return { screen: 'granted', camera: 'granted', mic: 'granted' }
  }
})

ipcMain.handle('request-media-access', async (_, mediaType) => {
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    try { return await systemPreferences.askForMediaAccess(mediaType) } catch { return false }
  }
  return true
})

ipcMain.handle('open-system-settings', async (_, type) => {
  if (process.platform === 'darwin') {
    if (type === 'screen') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    else if (type === 'camera') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera')
    else if (type === 'microphone') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
  }
})

// ── Commercial License & Trial Handlers ──
ipcMain.handle('get-license-status', () => licenseManager.getStatus())
ipcMain.handle('activate-license-key', (_, key) => licenseManager.activate(key))
ipcMain.handle('tick-trial', (_, seconds) => licenseManager.tickTrial(seconds))
ipcMain.handle('open-payment-link', (_, provider) => licenseManager.openPayment(provider))

ipcMain.handle('start-paypal-checkout', async () => {
  try {
    const result = await paypalService.startCheckout(mainWindow)
    if (result.success) {
      const activation = licenseManager.generateAndActivateKey()
      return {
        success: true,
        licenseKey: activation.key,
        orderId: result.orderId,
        status: licenseManager.getStatus()
      }
    } else {
      return { success: false, canceled: result.canceled }
    }
  } catch (err) {
    console.error('[PayPal Checkout Error]:', err.message)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('save-recording', async (event, { buffer, format }) => {
  const ext = (format || 'mp4').toLowerCase()
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const tmpWebm = path.join(os.tmpdir(), `screenrec-src-${ts}.webm`)
  const defaultName = `screenrec-${ts}.${ext}`

  try {
    fs.writeFileSync(tmpWebm, Buffer.from(buffer))
  } catch (err) {
    return { success: false, error: 'Kunne ikke opprette kilde-buffer: ' + err.message }
  }

  const filterMap = {
    mp4:  { name: 'MP4 Video (*.mp4)', extensions: ['mp4'] },
    webm: { name: 'WebM Video (*.webm)', extensions: ['webm'] },
    mov:  { name: 'MOV QuickTime (*.mov)', extensions: ['mov'] },
    avi:  { name: 'AVI Video (*.avi)', extensions: ['avi'] },
    webp: { name: 'Animated WebP (*.webp)', extensions: ['webp'] }
  }
  const primary = filterMap[ext] || filterMap.mp4
  const others  = Object.values(filterMap).filter(f => f.extensions[0] !== primary.extensions[0])

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Lagre opptak',
    defaultPath: path.join(app.getPath('videos'), defaultName),
    filters: [primary, ...others]
  })

  if (canceled || !filePath) {
    try { fs.unlinkSync(tmpWebm) } catch {}
    return { success: false, canceled: true }
  }

  const chosenExt = (path.extname(filePath).slice(1) || ext).toLowerCase()

  if (chosenExt === 'webm') {
    try {
      fs.copyFileSync(tmpWebm, filePath)
      fs.unlinkSync(tmpWebm)
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const ffmpegBinary = getFFmpegPath()
  // Atomic conversion to a temp file first, so filePath is never a corrupt 48-byte stub
  const tmpOut = path.join(os.tmpdir(), `screenrec-out-${ts}.${chosenExt}`)
  const isMac = process.platform === 'darwin'
  const useVideoToolbox = isMac && (chosenExt === 'mp4' || chosenExt === 'mov')

  const ffmpegArgs = ['-i', tmpWebm]

  if (chosenExt === 'webp') {
    ffmpegArgs.push('-an', '-c:v', 'libwebp', '-quality', '80', '-loop', '0')
  } else {
    if (useVideoToolbox) {
      ffmpegArgs.push(
        '-c:v', 'h264_videotoolbox',
        '-b:v', '6000k',
        '-pix_fmt', 'yuv420p'
      )
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p'
      )
    }

    ffmpegArgs.push(
      '-c:a', chosenExt === 'avi' ? 'libmp3lame' : 'aac',
      '-b:a', '192k'
    )

    if (chosenExt === 'mp4' || chosenExt === 'mov') {
      ffmpegArgs.push('-movflags', '+faststart')
    }
  }
  ffmpegArgs.push('-y', tmpOut)

  return new Promise((resolve) => {
    execFile(ffmpegBinary, ffmpegArgs, (err, _stdout, stderr) => {
      if (err) {
        if (useVideoToolbox) {
          console.warn('VideoToolbox encoder failed, retrying with libx264 software encoder:', stderr || err.message)
          const fallbackArgs = [
            '-i', tmpWebm,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p',
            '-c:a', chosenExt === 'avi' ? 'libmp3lame' : 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y', tmpOut
          ]
          execFile(ffmpegBinary, fallbackArgs, (fbErr, _fbStdout, fbStderr) => {
            try { fs.unlinkSync(tmpWebm) } catch {}
            if (fbErr) {
              try { fs.unlinkSync(tmpOut) } catch {}
              console.error('FFmpeg fallback error:', fbStderr || fbErr.message)
              resolve({ success: false, error: 'Konvertering feilet: ' + (fbStderr || fbErr.message) })
            } else {
              try {
                fs.copyFileSync(tmpOut, filePath)
                fs.unlinkSync(tmpOut)
                resolve({ success: true, filePath })
              } catch (copyErr) {
                resolve({ success: false, error: copyErr.message })
              }
            }
          })
          return
        }

        try { fs.unlinkSync(tmpWebm) } catch {}
        try { fs.unlinkSync(tmpOut) } catch {}
        console.error('FFmpeg error:', stderr || err.message)
        resolve({ success: false, error: 'Konvertering feilet: ' + (stderr || err.message) })
      } else {
        try { fs.unlinkSync(tmpWebm) } catch {}
        try {
          fs.copyFileSync(tmpOut, filePath)
          fs.unlinkSync(tmpOut)
          resolve({ success: true, filePath })
        } catch (copyErr) {
          resolve({ success: false, error: copyErr.message })
        }
      }
    })
  })
})

ipcMain.on('minimize-window', () => mainWindow?.minimize())
ipcMain.on('close-window', () => mainWindow?.close())
