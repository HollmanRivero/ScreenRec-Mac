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

// License & Modal Elements
const licenseBadge        = document.getElementById('license-badge')
const licenseBadgeIcon    = document.getElementById('license-badge-icon')
const licenseBadgeText    = document.getElementById('license-badge-text')
const licenseModal        = document.getElementById('license-modal')
const modalTitle          = document.getElementById('modal-title')
const modalSubtitle       = document.getElementById('modal-subtitle')
const modalTrialBox       = document.getElementById('modal-trial-box')
const modalTrialTimer     = document.getElementById('modal-trial-timer')
const modalTrialDesc      = document.getElementById('modal-trial-desc')
const btnStartTrial       = document.getElementById('btn-start-trial')
const btnPayPayPal        = document.getElementById('btn-pay-paypal')
const btnPayVipps         = document.getElementById('btn-pay-vipps')
const vippsInstructions   = document.getElementById('vipps-instructions')
const btnCopyVipps        = document.getElementById('btn-copy-vipps')
const btnPayWhatsApp      = document.getElementById('btn-pay-whatsapp')
const inputLicenseKey     = document.getElementById('input-license-key')
const btnActivateKey      = document.getElementById('btn-activate-key')
const activationMessage   = document.getElementById('activation-message')
const btnCloseModal       = document.getElementById('btn-close-modal')

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

let licenseStatus = {
  isActivated: false,
  isExpired: false,
  trialRemainingSeconds: 600
}

// ── Window Controls ──
if (btnMinimize) btnMinimize.addEventListener('click', () => ipcRenderer.send('minimize-window'))
if (btnClose)    btnClose.addEventListener('click', () => ipcRenderer.send('close-window'))

if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', () => {
    ipcRenderer.invoke('open-system-settings', 'screen')
  })
}

// ── License & Trial UI Logic ──
function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function updateLicenseUI(status) {
  if (!status) return
  licenseStatus = status
  const rem = status.trialRemainingSeconds || 0
  const timeStr = formatTime(rem)

  if (status.isActivated) {
    if (licenseBadge) {
      licenseBadge.className = 'license-badge pro'
      licenseBadgeIcon.textContent = '⭐'
      licenseBadgeText.textContent = 'PRO LISENS'
      licenseBadge.title = 'Aktiv lisens: Full versjon'
    }
    if (modalTrialBox) modalTrialBox.classList.add('hidden')
    if (modalTitle) modalTitle.textContent = 'ScreenRec Pro (Aktivert)'
    if (modalSubtitle) modalSubtitle.textContent = 'Du har fullversjon med ubegrenset opptakstid.'
    if (btnCloseModal) btnCloseModal.classList.remove('hidden')
  } else if (status.isExpired) {
    if (licenseBadge) {
      licenseBadge.className = 'license-badge expired'
      licenseBadgeIcon.textContent = '🔒'
      licenseBadgeText.textContent = 'Prøvetid Utløpt'
      licenseBadge.title = 'Prøveperioden er utløpt — klikk for å kjøpe lisens'
    }
    if (modalTrialBox) modalTrialBox.classList.remove('hidden')
    if (modalTrialTimer) modalTrialTimer.textContent = '00:00'
    if (modalTrialDesc) modalTrialDesc.textContent = 'Din 10-minutters gratis prøvetid er over. Kjøp eller aktiver en lisens for å fortsette opptak.'
    if (btnStartTrial) {
      btnStartTrial.disabled = true
      btnStartTrial.textContent = 'Prøvetid Utløpt'
      btnStartTrial.style.opacity = '0.5'
    }
    if (btnCloseModal) btnCloseModal.classList.add('hidden')
    showLicenseModal(true)
  } else {
    if (licenseBadge) {
      licenseBadge.className = 'license-badge trial'
      licenseBadgeIcon.textContent = '⏳'
      licenseBadgeText.textContent = `Prøvetid: ${timeStr}`
      licenseBadge.title = `10-minutters prøvetid: ${timeStr} igjen`
    }
    if (modalTrialBox) modalTrialBox.classList.remove('hidden')
    if (modalTrialTimer) modalTrialTimer.textContent = `${timeStr} igjen`
    if (btnStartTrial) {
      btnStartTrial.disabled = false
      btnStartTrial.textContent = 'Fortsett Prøveperiode'
      btnStartTrial.style.opacity = '1'
    }
    if (btnCloseModal) btnCloseModal.classList.remove('hidden')
  }
}

function showLicenseModal(show) {
  if (!licenseModal) return
  if (show) {
    licenseModal.classList.remove('hidden')
  } else {
    if (!licenseStatus.isExpired || licenseStatus.isActivated) {
      licenseModal.classList.add('hidden')
    }
  }
}

// License Badge Click
if (licenseBadge) {
  licenseBadge.addEventListener('click', () => showLicenseModal(true))
}

// Modal Buttons
if (btnStartTrial) {
  btnStartTrial.addEventListener('click', () => {
    if (!licenseStatus.isExpired || licenseStatus.isActivated) {
      showLicenseModal(false)
    }
  })
}

if (btnCloseModal) {
  btnCloseModal.addEventListener('click', () => {
    if (!licenseStatus.isExpired || licenseStatus.isActivated) {
      showLicenseModal(false)
    }
  })
}

if (btnPayVipps) {
  btnPayVipps.addEventListener('click', () => {
    if (vippsInstructions) {
      vippsInstructions.classList.toggle('hidden')
    }
  })
}

if (btnCopyVipps) {
  btnCopyVipps.addEventListener('click', () => {
    navigator.clipboard.writeText('97269623').then(() => {
      btnCopyVipps.textContent = 'Kopiert! ✓'
      setTimeout(() => { btnCopyVipps.textContent = 'Kopier nr: 97269623' }, 2000)
    }).catch(() => {
      btnCopyVipps.textContent = 'Nr: 972 69 623'
    })
  })
}

if (btnPayPayPal) {
  btnPayPayPal.addEventListener('click', async () => {
    setStatus('Åpner PayPal betaling…')
    btnPayPayPal.disabled = true
    try {
      const res = await ipcRenderer.invoke('start-paypal-checkout')
      if (res.success) {
        updateLicenseUI(res.status)
        if (activationMessage) {
          activationMessage.className = 'activation-message success'
          activationMessage.textContent = `🎉 Betaling på €30 EUR fullført! Din lisens: ${res.licenseKey}`
        }
        setStatus(`ScreenRec Pro er aktivert! Lisens: ${res.licenseKey}`)
        setTimeout(() => showLicenseModal(false), 3500)
      } else if (res.canceled) {
        setStatus('PayPal betaling avbrutt.')
      } else {
        setStatus('PayPal feil: ' + (res.error || 'Kunne ikke fullføre betaling'))
      }
    } catch (err) {
      setStatus('PayPal feil: ' + err.message)
    } finally {
      btnPayPayPal.disabled = false
    }
  })
}

if (btnPayWhatsApp) {
  btnPayWhatsApp.addEventListener('click', () => {
    ipcRenderer.invoke('open-payment-link', 'whatsapp')
  })
}

// Key Activation
if (btnActivateKey) {
  btnActivateKey.addEventListener('click', async () => {
    const key = (inputLicenseKey ? inputLicenseKey.value : '').trim()
    if (!key) {
      if (activationMessage) {
        activationMessage.className = 'activation-message error'
        activationMessage.textContent = 'Vennligst skriv inn en lisensnøkkel.'
      }
      return
    }

    if (activationMessage) {
      activationMessage.className = 'activation-message'
      activationMessage.textContent = 'Sjekker lisensnøkkel…'
    }

    try {
      const res = await ipcRenderer.invoke('activate-license-key', key)
      if (res.success) {
        if (activationMessage) {
          activationMessage.className = 'activation-message success'
          activationMessage.textContent = res.message || 'Lisens aktivert!'
        }
        updateLicenseUI(res.status)
        setTimeout(() => showLicenseModal(false), 1200)
      } else {
        if (activationMessage) {
          activationMessage.className = 'activation-message error'
          activationMessage.textContent = res.error || 'Ugyldig lisensnøkkel.'
        }
      }
    } catch (err) {
      if (activationMessage) {
        activationMessage.className = 'activation-message error'
        activationMessage.textContent = 'Kunne ikke aktivere: ' + err.message
      }
    }
  })
}

// ── Quick Mode Buttons ──
function clearSelection() {
  document.querySelectorAll('.quick-card').forEach(c => c.classList.remove('selected'))
  document.querySelectorAll('.source-item').forEach(i => i.classList.remove('selected'))
}

if (btnModeScreen) {
  btnModeScreen.addEventListener('click', async () => {
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
    sourceTabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentFilter = tab.dataset.filter
    renderSourceList()
  })
})

if (btnRefresh) {
  btnRefresh.addEventListener('click', async () => {
    await loadSources()
  })
}

// ── Load Sources with Visual Feedback ──
async function loadSources() {
  if (btnRefresh) btnRefresh.classList.add('spinning')
  setStatus('Oppdaterer kildeliste…')
  try {
    allSources = await ipcRenderer.invoke('get-sources')
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
    camStream = await getCameraStream()
    screenStream = camStream
    selectedSource = { id: 'webcam-only', name: 'Kun Webcam', isWebcam: true }

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
  
  previewScreen.muted = true
  previewScreen.srcObject = stream
  previewScreen.style.display = 'block'
  
  const p = previewScreen.play()
  if (p !== undefined) {
    p.catch(err => {
      console.warn('Preview direct play notice:', err)
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
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } },
      audio: true
    })
  } catch (err) {
    console.warn('getDisplayMedia with audio failed, falling back to video only:', err)
    return await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } },
      audio: false
    })
  }
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

  // Check license state before starting
  if (licenseStatus.isExpired && !licenseStatus.isActivated) {
    showLicenseModal(true)
    setStatus('Prøvetiden er utløpt — aktiver lisens for å ta opp')
    return
  }

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
  isRecording = false

  btnRecord.classList.remove('recording')
  btnRecordLabel.textContent = 'Start Opptak'
  recBadge.classList.add('hidden')
  timerEl.classList.add('hidden')
  stopTimer()
  setStatus('Fullfører opptak…')
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
  // Clean up recording tracks safely now that mediaRecorder has flushed all data
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop())
    micStream = null
  }
  if (audioCtx) {
    try { await audioCtx.close() } catch {}
    audioCtx = null
  }
  if (compositionCleanup) {
    compositionCleanup()
    compositionCleanup = null
  }

  const outputFormat = selectFormat.value
  setStatus(`Klargjør og optimaliserer ${outputFormat.toUpperCase()}…`)
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

// Timer helpers & Trial Countdown
function startTimer() {
  elapsedSeconds = 0
  timerEl.textContent = '00:00'
  timerInterval = setInterval(async () => {
    elapsedSeconds++
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')
    const s = String(elapsedSeconds % 60).padStart(2, '0')
    timerEl.textContent = `${m}:${s}`

    // Tick trial consumption if not activated
    if (!licenseStatus.isActivated) {
      try {
        const updated = await ipcRenderer.invoke('tick-trial', 1)
        updateLicenseUI(updated)

        if (updated.isExpired) {
          console.log('[TRIAL] 10 minutters prøvetid nådd! Stopper opptak.')
          stopRecording()
          setStatus('Prøvetiden (10 minutter) er nådd — opptak lagret.')
          showLicenseModal(true)
        }
      } catch (err) {
        console.warn('Trial tick error:', err)
      }
    }
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

  // Load and apply initial license status
  try {
    const lic = await ipcRenderer.invoke('get-license-status')
    updateLicenseUI(lic)
    // If not activated and first launch or expired, show modal
    if (lic.isExpired) {
      showLicenseModal(true)
    }
  } catch (err) {
    console.warn('Could not load license status:', err)
  }

  await loadSources()
  try {
    const perms = await ipcRenderer.invoke('check-permissions')
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
