const { app, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const MAX_TRIAL_SECONDS = 600 // 10 minutes total recording time

class LicenseManager {
  constructor() {
    this.storagePath = path.join(app.getPath('userData'), 'license-data.json')
    this.state = {
      isActivated: false,
      licenseKey: null,
      trialSecondsUsed: 0,
      firstUsedAt: null,
      activatedAt: null
    }
    this.loadState()
  }

  loadState() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8')
        const data = JSON.parse(raw)
        this.state = { ...this.state, ...data }
      } else {
        this.state.firstUsedAt = new Date().toISOString()
        this.saveState()
      }
    } catch (e) {
      console.warn('[LicenseManager] Could not read license state, resetting:', e.message)
    }
  }

  saveState() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.state, null, 2), 'utf8')
    } catch (e) {
      console.error('[LicenseManager] Could not save license state:', e.message)
    }
  }

  getStatus() {
    const isActivated = !!this.state.isActivated
    const remaining = isActivated ? Infinity : Math.max(0, MAX_TRIAL_SECONDS - (this.state.trialSecondsUsed || 0))
    const isExpired = !isActivated && remaining <= 0

    return {
      isActivated,
      licenseKey: this.state.licenseKey,
      trialSecondsUsed: this.state.trialSecondsUsed || 0,
      trialRemainingSeconds: remaining,
      maxTrialSeconds: MAX_TRIAL_SECONDS,
      isExpired
    }
  }

  tickTrial(seconds = 1) {
    if (this.state.isActivated) {
      return this.getStatus()
    }

    this.state.trialSecondsUsed = (this.state.trialSecondsUsed || 0) + seconds
    this.saveState()
    return this.getStatus()
  }

  // Validates customer license key
  // Supports:
  // 1. Master/Owner keys: SCREC-HOLLMAN-PRO-2026, SCREC-LIFETIME-PRO, SCREC-ADMIN-2026
  // 2. Algorithmic Keys: SCREC-XXXX-XXXX-XXXX where the last block is a checksum of the middle blocks
  // 3. Lemon Squeezy / Gumroad standard license key patterns
  validateKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return false
    const key = rawKey.trim().toUpperCase()

    // Master / Owner bypass keys
    const masterKeys = [
      'SCREC-HOLLMAN-PRO-2026',
      'SCREC-LIFETIME-PRO',
      'SCREC-ADMIN-2026',
      'SCREC-VIP-RIVERO'
    ]
    if (masterKeys.includes(key)) {
      return true
    }

    // Format: SCREC-XXXX-XXXX-XXXX (e.g. SCREC-9821-4328-D4F1)
    const match = key.match(/^SCREC-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
    if (match) {
      const part1 = match[1]
      const part2 = match[2]
      const check = match[3]
      const expectedCheck = crypto.createHash('sha256')
        .update(`SCREC-SALT-2026-${part1}-${part2}`)
        .digest('hex')
        .substring(0, 4)
        .toUpperCase()

      if (check === expectedCheck) return true
    }

    // Lemon Squeezy UUID license format (e.g. 8-4-4-4-12 hex format)
    const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i
    if (uuidRegex.test(key)) {
      return true
    }

    return false
  }

  generateKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let part1 = ''
    let part2 = ''
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length))
      part2 += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const check = crypto.createHash('sha256')
      .update(`SCREC-SALT-2026-${part1}-${part2}`)
      .digest('hex')
      .substring(0, 4)
      .toUpperCase()

    return `SCREC-${part1}-${part2}-${check}`
  }

  generateAndActivateKey() {
    const key = this.generateKey()
    const res = this.activate(key)
    return { key, ...res }
  }

  activate(rawKey) {
    const key = (rawKey || '').trim().toUpperCase()
    if (!this.validateKey(key)) {
      return { success: false, error: 'Ugyldig lisensnøkkel. Sjekk koden eller kontakt support.' }
    }

    this.state.isActivated = true
    this.state.licenseKey = key
    this.state.activatedAt = new Date().toISOString()
    this.saveState()

    return {
      success: true,
      message: 'ScreenRec Pro er nå aktivert! Takk for kjøpet.',
      status: this.getStatus()
    }
  }

  openPayment(provider) {
    let url = ''
    if (provider === 'paypal') {
      url = 'https://paypal.me/hollmanrivero/30EUR'
    } else if (provider === 'lemonsqueezy' || provider === 'card') {
      url = 'https://hollmanrivero.lemonsqueezy.com/checkout'
    } else if (provider === 'whatsapp') {
      url = 'https://wa.me/4797269623?text=Hei%20Hollman!%20Jeg%20vil%20kj%C3%B8pe%20lisens%20til%20ScreenRec%20for%2030%20EUR.'
    } else {
      url = 'https://paypal.me/hollmanrivero/30EUR'
    }

    if (url) {
      shell.openExternal(url).catch(err => console.error('[LicenseManager] Failed to open URL:', err))
    }
  }
}

module.exports = new LicenseManager()
