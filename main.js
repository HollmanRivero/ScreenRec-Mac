const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, systemPreferences, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFile } = require('child_process')

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
        callback({ video: source })
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

ipcMain.handle('save-recording', async (event, { buffer, format }) => {
  const ext = (format || 'mp4').toLowerCase()
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const tmpWebm = path.join(os.tmpdir(), `screenrec-${ts}.webm`)
  const defaultName = `screenrec-${ts}.${ext}`

  try {
    fs.writeFileSync(tmpWebm, Buffer.from(buffer))
  } catch (err) {
    return { success: false, error: 'Kunne ikke opprette fil: ' + err.message }
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
  const ffmpegArgs = ['-i', tmpWebm]

  if (chosenExt === 'webp') {
    ffmpegArgs.push('-an', '-c:v', 'libwebp', '-quality', '80', '-loop', '0')
  } else {
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-c:a', chosenExt === 'avi' ? 'libmp3lame' : 'aac',
      '-b:a', '192k'
    )
  }
  ffmpegArgs.push('-y', filePath)

  return new Promise((resolve) => {
    execFile(ffmpegBinary, ffmpegArgs, (err, _stdout, stderr) => {
      try { fs.unlinkSync(tmpWebm) } catch {}
      if (err) {
        console.error('FFmpeg error:', stderr || err.message)
        const fallbackPath = filePath.replace(/\.[^/.]+$/, '') + '.webm'
        try {
          fs.writeFileSync(fallbackPath, Buffer.from(buffer))
          resolve({ success: true, filePath: fallbackPath, fallbackNotice: 'Lagret som WebM: ' + fallbackPath })
        } catch {
          resolve({ success: false, error: stderr || err.message })
        }
      } else {
        resolve({ success: true, filePath })
      }
    })
  })
})

ipcMain.on('minimize-window', () => mainWindow?.minimize())
ipcMain.on('close-window', () => mainWindow?.close())
