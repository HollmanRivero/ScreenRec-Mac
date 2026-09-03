const { ipcRenderer } = require('electron')

// ── DOM Elements ──
const btnModeScreen      = document.getElementById('btn-mode-screen')
const btnModeCombo       = document.getElementById('btn-mode-combo')
const btnModeWebcam      = document.getElementById('btn-mode-webcam')
const sourceList         = document.getElementById('source-list')
const btnRefresh         = document.getElementById('btn-refresh')
const sourceTabs        = document.querySelectorAll('.source-tab')
const btnRecord          = document.getElementById('btn-record')
const btnRecordLabel     = document.getElementById('btn-record-label')
const previewScreen      = document.getElementById('preview-screen')
const previewCam         = document.getElementById('preview-cam')
const previewPlaceholder = document.getElementById('preview-placeholder')
const recBadge           = document.getElementById('rec-badge')
const timerEl            = document.getElementById('timer')
const statusEl           = document.getElementById('status')
const toggleCam          = document.getElementById('toggle-cam')
const togglePreview      = document.getElementById('toggle-preview')
const toggleMic          = document.getElementById('toggle-mic')
const toggleDesktopAudio = document.getElementById('toggle-desktop-audio')
const selectFormat       = document.getElementById('select-format')
const btnMinimize        = document.getElementById('btn-minimize')
const btnClose           = document.getElementById('btn-close')
const permissionBanner   = document.getElementById('permission-banner')
const btnOpenSettings    = document.getElementById('btn-open-settings')

// Ensure muted state is set in JavaScript to bypass Chromium Autoplay restrictions
if (previewScreen) previewScreen.muted = true
if (previewCam)    previewCam.muted = true

// ── State ──
let allSources          = []
let currentFilter       = 'all'
let selectedSource      = null
let screenStream        = null
let camStream           = null
let micStream           = null
let audioCtx            = null
let mediaRecorder       = null
let recordedChunks      = []
let isRecording         = false
let isStartingRecording = false
let timerInterval       = null
let elapsedSeconds      = 0
let compositionCleanup  = null

// ── Window Controls ──
if (btnMinimize) btnMinimize.addEventListener('click', () => ipcRenderer.send('minimize-window'))
if (btnClose)    btnClose.addEventListener('click', () => ipcRenderer.send('close-window'))

if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', () => {
    ipcRenderer.invoke('open-system-settings', 'screen')
  })
}

// ── Quick Mode Buttons ──
function clearSelection() {
  document.querySelectorAll('.quick-card').forEach(c => c.classList.remove('selected'))
  document.querySelectorAll('.source-item').forEach(i => i.classList.remove('selected'))
}

if (btnModeScreen) {
  btnModeScreen.addEventListener('click', async () => {
    console.log('[UI] Klikket: Bare Skjermen')
    clearSelection()
    btnModeScreen.classList.add('selected')
    toggleCam.checked = false
    if (previewCam) {
      previewCam.classList.add('hidden')
      previewCam.style.display = 'none'
    }
    await selectEntireScreen()
  })
}

if (btnModeCombo) {
  btnModeCombo.addEventListener('click', async () => {
    console.log('[UI] Klikket: Skjerm + Webcam')
    clearSelection()
    btnModeCombo.classList.add('selected')
    toggleCam.checked = true
    toggleCam.dispatchEvent(new Event('change'))
    await selectEntireScreen()
    setStatus('Aktiv: Skjerm + Webcam overlay')
  })
}

if (btnModeWebcam) {
  btnModeWebcam.addEventListener('click', async () => {
    console.log('[UI] Klikket: Kun Webcam')
    clearSelection()
    btnModeWebcam.classList.add('selected')
    toggleCam.checked = false
    if (previewCam) {
      previewCam.classList.add('hidden')
      previewCam.style.display = 'none'
    }
    await selectWebcamOnly()
  })
}

// ── Source Category Tabs ──
sourceTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    console.log('[UI] Fane valgt:', tab.dataset.filter)
    sourceTabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentFilter = tab.dataset.filter
    renderSourceList()
  })
})

if (btnRefresh) {
  btnRefresh.addEventListener('click', async () => {
    console.log('[UI] Klikket: Refresh')
    await loadSources()
  })
}

// ── Load Sources with Visual Feedback ──
async function loadSources() {
  if (btnRefresh) btnRefresh.classList.add('spinning')
  setStatus('Oppdaterer kildeliste…')
  try {
    allSources = await ipcRenderer.invoke('get-sources')
    console.log('[RENDERER] Kilder hentet:', allSources.length)
    renderSourceList()
    setStatus(`Fant ${allSources.length} kilder`)
    setTimeout(() => {
      if (selectedSource) setStatus(`Valgt: ${selectedSource.name}`)
      else setStatus('Klar')
    }, 1500)
  } catch (err) {
    sourceList.innerHTML = '<div class="source-placeholder">Kunne ikke hente vindusliste</div>'
    console.warn('loadSources error:', err)
    setStatus('Feil ved kildeoppdatering')
  } finally {
    if (btnRefresh) {
      setTimeout(() => btnRefresh.classList.remove('spinning'), 400)
    }
  }
}

// ── Render Source List ──
function renderSourceList() {
  sourceList.innerHTML = ''

  const filtered = allSources.filter(s => {
    if (currentFilter === 'screen') return s.type === 'screen'
    if (currentFilter === 'window') return s.type === 'window'
    return true
  })

  if (filtered.length === 0) {
    const emptyMsg = document.createElement('div')
    emptyMsg.className = 'source-placeholder'
    emptyMsg.textContent = 'Ingen vinduer/skjermer funnet'
    sourceList.appendChild(emptyMsg)
    return
  }

  filtered.forEach(source => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'source-item'
    item.dataset.id = source.id

    if (source.thumbnail) {
      const img = document.createElement('img')
      img.className = 'source-thumb'
      img.src = source.thumbnail
      item.appendChild(img)
    } else {
      const icon = document.createElement('div')
      icon.className = 'source-thumb source-thumb-icon'
      icon.textContent = source.type === 'screen' ? '🖥️' : '🪟'
      item.appendChild(icon)
    }

    const info = document.createElement('div')
    info.className = 'source-info'

    const title = document.createElement('span')
    title.className = 'source-name'
    title.title = source.name
    title.textContent = source.name

    const badge = document.createElement('span')
    badge.className = 'source-badge'
    badge.textContent = source.type === 'screen' ? 'Skjerm' : 'Vindu'

    info.appendChild(title)
    info.appendChild(badge)
    item.appendChild(info)

    item.addEventListener('click', () => {
      console.log('[UI] Klikket kilde:', source.name)
      selectSource(source, item)
    })
    sourceList.appendChild(item)
  })

  if (selectedSource && selectedSource.id) {
    const el = sourceList.querySelector(`[data-id="${selectedSource.id}"]`)
    if (el) el.classList.add('selected')
  }
}

// ── Stream Capture ──

async function selectEntireScreen() {
  stopPreviousScreenStream()
  setStatus('Kobler til skjerm…')
  try {
    if (!allSources || allSources.length === 0) {
      allSources = await ipcRenderer.invoke('get-sources')
      renderSourceList()
    }
    
    const screenSource = allSources.find(s => s.type === 'screen') || allSources[0]
    selectedSource = screenSource || { id: 'screen:main', name: 'Hele Skjermen', type: 'screen' }

    console.log('[RENDERER] Åpner skjermkilde:', selectedSource.id, selectedSource.name)
    screenStream = await getDesktopStream(selectedSource)
    attachToPreview(screenStream)
    setStatus('Forhåndsvisning: Bare Skjermen')
  } catch (err) {
    console.error('selectEntireScreen error:', err)
    setStatus('Kunne ikke hente skjerm: ' + err.message)
    showPlaceholder(true)
  }
}

async function selectWebcamOnly() {
  stopPreviousScreenStream()
  setStatus('Åpner webcam…')
  try {
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop())
      camStream = null
    }
    console.log('[RENDERER] Ber om tilgang til webcam...')
    camStream = await getCameraStream()
    screenStream = camStream
    selectedSource = { id: 'webcam-only', name: 'Kun Webcam', isWebcam: true }

    console.log('[RENDERER] Webcam åpnet:', camStream.getVideoTracks()[0]?.label)
    attachToPreview(screenStream)
    setStatus('Forhåndsvisning: Kun Webcam')
  } catch (err) {
    console.error('selectWebcamOnly error:', err)
    setStatus('Kunne ikke åpne webcam: ' + err.message)
    showPlaceholder(true)
  }
}

async function selectSource(source, itemEl) {
  clearSelection()
  if (itemEl) itemEl.classList.add('selected')

  stopPreviousScreenStream()
  selectedSource = source

  setStatus(`Kobler til: ${source.name}…`)
  try {
    console.log('[RENDERER] Kobler til kilde:', source.name)
    screenStream = await getDesktopStream(source)
    attachToPreview(screenStream)
    setStatus(`Forhåndsvisning: ${source.name}`)
  } catch (err) {
    console.error('selectSource error:', err)
    setStatus('Feil ved kildevalg: ' + err.message)
    showPlaceholder(true)
  }
}

function attachToPreview(stream) {
  if (!stream) return
  
  console.log('[RENDERER] Kobler stream til preview element:', stream.getTracks().map(t => t.kind + ':' + t.label))
  previewScreen.muted = true
  previewScreen.srcObject = stream
  previewScreen.style.display = 'block'
  
  const p = previewScreen.play()
  if (p !== undefined) {
    p.then(() => console.log('[RENDERER] Video play() suksess'))
     .catch(err => {
        console.warn('[RENDERER] Preview direct play notice:', err)
        previewScreen.muted = true
        previewScreen.play().catch(() => {})
     })
  }

  showPlaceholder(false)

  if (btnRecord) btnRecord.disabled = false

  const videoTrack = stream.getVideoTracks()[0]
  if (videoTrack) {
    videoTrack.onended = () => {
      if (isRecording) stopRecording()
      showPlaceholder(true)
      if (btnRecord) btnRecord.disabled = true
      setStatus('Kilden ble avsluttet')
    }
  }
}

function showPlaceholder(visible) {
  if (previewPlaceholder) {
    if (visible) {
      previewPlaceholder.classList.remove('hidden')
      previewPlaceholder.style.display = 'flex'
    } else {
      previewPlaceholder.classList.add('hidden')
      previewPlaceholder.style.display = 'none'
    }
  }
}

function stopPreviousScreenStream() {
  if (screenStream && screenStream !== camStream) {
    screenStream.getTracks().forEach(t => t.stop())
  }
  screenStream = null
}

async function getDesktopStream(source) {
  if (source && source.id) {
    await ipcRenderer.invoke('set-source-id', source.id)
  }
  return await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 } },
    audio: false
  })
}

async function getCameraStream() {
  try { await ipcRenderer.invoke('request-media-access', 'camera') } catch {}

  const tierList = [
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false },
    { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: true, audio: false }
  ]

  let lastErr = null
  for (const constraints of tierList) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Kamera utilgjengelig')
}

async function getMicrophoneStream() {
  try { await ipcRenderer.invoke('request-media-access', 'microphone') } catch {}

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    })
  } catch {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  }
}

// ── Camera Overlay (PiP) ──
toggleCam.addEventListener('change', async () => {
  if (toggleCam.checked) {
    try {
      if (!camStream || camStream.getTracks().some(t => t.readyState === 'ended')) {
        camStream = await getCameraStream()
      }
      previewCam.muted = true
      previewCam.srcObject = camStream
      previewCam.classList.remove('hidden')
      previewCam.style.display = 'block'
      previewCam.play().catch(e => console.warn('Cam overlay play:', e))
    } catch (err) {
      toggleCam.checked = false
      previewCam.classList.add('hidden')
      previewCam.style.display = 'none'
      setStatus('Kamera ikke tilgjengelig: ' + err.message)
    }
  } else {
    if (camStream && camStream !== screenStream) {
      camStream.getTracks().forEach(t => t.stop())
      camStream = null
    }
    previewCam.classList.add('hidden')
    previewCam.style.display = 'none'
    previewCam.srcObject = null
  }
})

togglePreview.addEventListener('change', () => {
  if (togglePreview.checked && camStream && toggleCam.checked) {
    previewCam.classList.remove('hidden')
    previewCam.style.display = 'block'
  } else {
    previewCam.classList.add('hidden')
    previewCam.style.display = 'none'
  }
})

// ── Draggable PiP Camera ──
let dragging = false, dragOffX = 0, dragOffY = 0

previewCam.addEventListener('mousedown', e => {
  dragging = true
  const rect = previewCam.getBoundingClientRect()
  dragOffX = e.clientX - rect.left
  dragOffY = e.clientY - rect.top
  previewCam.style.cursor = 'grabbing'
})

document.addEventListener('mousemove', e => {
  if (!dragging) return
  const wrap = document.querySelector('.preview-wrap').getBoundingClientRect()
  let x = e.clientX - wrap.left - dragOffX
  let y = e.clientY - wrap.top  - dragOffY
  x = Math.max(0, Math.min(wrap.width  - previewCam.offsetWidth,  x))
  y = Math.max(0, Math.min(wrap.height - previewCam.offsetHeight, y))
  previewCam.style.right  = 'auto'
  previewCam.style.bottom = 'auto'
  previewCam.style.left   = x + 'px'
  previewCam.style.top    = y + 'px'
})

document.addEventListener('mouseup', () => {
  if (dragging) {
    dragging = false
    previewCam.style.cursor = 'move'
  }
})

// ── Recording Execution ──
btnRecord.addEventListener('click', () => {
  if (isRecording) stopRecording()
  else             startRecording()
})

async function startRecording() {
  if (isStartingRecording || isRecording) return
  if (!selectedSource || !screenStream) {
    setStatus('Velg en kilde først')
    return
  }

  isStartingRecording = true
  btnRecord.disabled = true
  btnRecordLabel.textContent = 'Starter…'
  setStatus('Forbereder opptak…')

  try {
    recordedChunks = []

    // 1. Microphone
    micStream = null
    if (toggleMic.checked) {
      try {
        micStream = await getMicrophoneStream()
      } catch (err) {
        console.warn('Microphone error:', err)
        setStatus('Mikrofon utilgjengelig — tar opp uten lyd')
      }
    }

    // 2. Video Stream
    let finalStream
    const isWebcamMain = selectedSource && selectedSource.isWebcam
    if (camStream && toggleCam.checked && !isWebcamMain) {
      finalStream = await mixStreams()
    } else {
      finalStream = new MediaStream([...screenStream.getVideoTracks()])
    }

    // 3. Audio Tracks (direct attachment to avoid WebAudio suspension)
    const hasDesktop = !isWebcamMain && toggleDesktopAudio.checked && screenStream.getAudioTracks().length > 0
    const hasMic     = micStream && micStream.getAudioTracks().length > 0

    if (hasDesktop && hasMic) {
      try {
        audioCtx = new AudioContext()
        if (audioCtx.state === 'suspended') await audioCtx.resume()
        const dest = audioCtx.createMediaStreamDestination()
        audioCtx.createMediaStreamSource(new MediaStream(screenStream.getAudioTracks())).connect(dest)
        audioCtx.createMediaStreamSource(micStream).connect(dest)
        dest.stream.getAudioTracks().forEach(t => finalStream.addTrack(t))
      } catch {
        if (hasMic) micStream.getAudioTracks().forEach(t => finalStream.addTrack(t))
      }
    } else if (hasMic) {
      micStream.getAudioTracks().forEach(t => finalStream.addTrack(t))
    } else if (hasDesktop) {
      screenStream.getAudioTracks().forEach(t => finalStream.addTrack(t))
    }

    let mimeType = 'video/webm;codecs=vp9,opus'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm'
    }

    mediaRecorder = new MediaRecorder(finalStream, { mimeType })

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data)
      }
    }

    mediaRecorder.onstop = saveRecording

    mediaRecorder.start(200)
    isRecording = true

    btnRecord.disabled = false
    btnRecord.classList.add('recording')
    btnRecordLabel.textContent = 'Stopp Opptak'
    recBadge.classList.remove('hidden')
    timerEl.classList.remove('hidden')
    startTimer()
    setStatus('Tar opp…')
  } catch (err) {
    console.error('startRecording error:', err)
    setStatus('Opptaksfeil: ' + err.message)
    btnRecord.disabled = false
    btnRecordLabel.textContent = 'Start Opptak'
  } finally {
    isStartingRecording = false
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  mediaRecorder.stop()
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
  if (audioCtx)  { audioCtx.close(); audioCtx = null }
  if (compositionCleanup) { compositionCleanup(); compositionCleanup = null }
  isRecording = false

  btnRecord.classList.remove('recording')
  btnRecordLabel.textContent = 'Start Opptak'
  recBadge.classList.add('hidden')
  timerEl.classList.add('hidden')
  stopTimer()
  setStatus('Lagrer opptak…')
}

// Canvas Stream Mixer
async function mixStreams() {
  const canvas = document.createElement('canvas')
  const settings = screenStream.getVideoTracks()[0]?.getSettings() || {}
  canvas.width  = settings.width || 1280
  canvas.height = settings.height || 720
  const ctx = canvas.getContext('2d')

  const screenVid = document.createElement('video')
  screenVid.srcObject = new MediaStream(screenStream.getVideoTracks())
  screenVid.muted = true
  await screenVid.play()

  const camVid = document.createElement('video')
  camVid.srcObject = new MediaStream(camStream.getVideoTracks())
  camVid.muted = true
  await camVid.play()

  const pipRect = previewCam.getBoundingClientRect()
  const wrapRect = document.querySelector('.preview-wrap').getBoundingClientRect()
  const scaleX = canvas.width  / (wrapRect.width || canvas.width)
  const scaleY = canvas.height / (wrapRect.height || canvas.height)
  const pip = {
    x: (pipRect.left - wrapRect.left) * scaleX,
    y: (pipRect.top  - wrapRect.top)  * scaleY,
    w: pipRect.width  * scaleX,
    h: pipRect.height * scaleY
  }

  let frameId = null
  function drawFrame() {
    ctx.drawImage(screenVid, 0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.beginPath()
    if (ctx.roundRect) {
      ctx.roundRect(pip.x, pip.y, pip.w, pip.h, 12)
    } else {
      ctx.rect(pip.x, pip.y, pip.w, pip.h)
    }
    ctx.clip()
    ctx.drawImage(camVid, pip.x, pip.y, pip.w, pip.h)
    ctx.restore()
    frameId = requestAnimationFrame(drawFrame)
  }
  drawFrame()

  compositionCleanup = () => {
    if (frameId) cancelAnimationFrame(frameId)
    screenVid.pause()
    camVid.pause()
    screenVid.srcObject = null
    camVid.srcObject = null
  }
  return canvas.captureStream(settings.frameRate || 30)
}

// Save recording via IPC
async function saveRecording() {
  const outputFormat = selectFormat.value
  setStatus(`Konverterer til ${outputFormat.toUpperCase()}…`)
  const blob = new Blob(recordedChunks, { type: 'video/webm' })
  const arrayBuffer = await blob.arrayBuffer()
  
  const result = await ipcRenderer.invoke('save-recording', { buffer: arrayBuffer, format: outputFormat })
  if (result.success) {
    if (result.fallbackNotice) {
      setStatus(result.fallbackNotice)
    } else {
      setStatus('Opptak lagret!')
    }
  } else if (result.canceled) {
    setStatus('Lagring avbrutt.')
  } else {
    setStatus('Lagringsfeil: ' + (result.error || 'Ukjent feil'))
  }
  setTimeout(() => {
    if (selectedSource) setStatus(`Valgt: ${selectedSource.name}`)
  }, 3500)
}

// Timer helpers
function startTimer() {
  elapsedSeconds = 0
  timerEl.textContent = '00:00'
  timerInterval = setInterval(() => {
    elapsedSeconds++
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')
    const s = String(elapsedSeconds % 60).padStart(2, '0')
    timerEl.textContent = `${m}:${s}`
  }, 1000)
}

function stopTimer() {
  clearInterval(timerInterval)
  elapsedSeconds = 0
}

function setStatus(msg) {
  statusEl.textContent = msg
}

// ── Init ──
async function init() {
  console.log('[APP] Initialiserer...')
  await loadSources()
  try {
    const perms = await ipcRenderer.invoke('check-permissions')
    console.log('[APP] Tillatelser:', perms)
    if (perms.screen === 'denied' || perms.screen === 'not-determined') {
      if (permissionBanner) permissionBanner.classList.remove('hidden')
    }
  } catch {}

  if (btnModeScreen) {
    btnModeScreen.classList.add('selected')
    await selectEntireScreen()
  }
}

init()
