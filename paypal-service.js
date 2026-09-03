const { BrowserWindow, shell } = require('electron')
const path = require('path')
const fs = require('fs')

class PayPalService {
  constructor() {
    this.config = this.loadConfig()
    this.apiBase = this.config.mode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com'
  }

  loadConfig() {
    const configPath = path.join(__dirname, 'paypal-config.json')
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'))
      } catch (e) {
        console.warn('[PayPal] Could not parse paypal-config.json:', e.message)
      }
    }
    return {
      mode: 'sandbox',
      clientId: '',
      secretKey: '',
      price: '30.00',
      currency: 'EUR'
    }
  }

  // Get OAuth2 Access Token from PayPal
  async getAccessToken() {
    const auth = Buffer.from(`${this.config.clientId}:${this.config.secretKey}`).toString('base64')
    const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`PayPal OAuth feilet: ${response.status} - ${errText}`)
    }

    const data = await response.json()
    return data.access_token
  }

  // Create Checkout Order for 30.00 EUR
  async createOrder() {
    const accessToken = await this.getAccessToken()

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'screenrec_pro_lifetime',
          description: 'ScreenRec Pro - Livstidslisens',
          amount: {
            currency_code: this.config.currency || 'EUR',
            value: this.config.price || '30.00'
          }
        }
      ],
      application_context: {
        brand_name: 'ScreenRec Pro',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: 'https://screenrec.local/paypal-success',
        cancel_url: 'https://screenrec.local/paypal-cancel'
      }
    }

    const response = await fetch(`${this.apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Kunne ikke opprette PayPal-ordre: ${errText}`)
    }

    const order = await response.json()
    const approvalLink = order.links.find(link => link.rel === 'approve')?.href

    if (!approvalLink) {
      throw new Error('PayPal returnerte ingen godkjenningslenke.')
    }

    return {
      orderId: order.id,
      approvalUrl: approvalLink
    }
  }

  // Capture the order once approved
  async captureOrder(orderId) {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Kunne ikke fullføre betaling: ${errText}`)
    }

    const captureData = await response.json()
    return captureData
  }

  // Launch checkout window in Electron
  async startCheckout(parentWindow) {
    const { orderId, approvalUrl } = await this.createOrder()

    return new Promise((resolve, reject) => {
      const payWin = new BrowserWindow({
        width: 500,
        height: 700,
        parent: parentWindow || null,
        modal: true,
        show: true,
        title: 'PayPal Betaling — ScreenRec Pro (€30 EUR)',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      payWin.loadURL(approvalUrl)

      let handled = false

      const checkUrl = async (url) => {
        if (handled) return

        if (url.startsWith('https://screenrec.local/paypal-success')) {
          handled = true
          payWin.hide()
          try {
            console.log('[PayPal] Betaling godkjent av bruker, fullfører capture for ordre:', orderId)
            const capture = await this.captureOrder(orderId)
            payWin.close()
            resolve({ success: true, orderId, capture })
          } catch (err) {
            payWin.close()
            reject(err)
          }
        } else if (url.startsWith('https://screenrec.local/paypal-cancel')) {
          handled = true
          payWin.close()
          resolve({ success: false, canceled: true })
        }
      }

      payWin.webContents.on('will-redirect', (event, url) => {
        checkUrl(url)
      })

      payWin.webContents.on('will-navigate', (event, url) => {
        checkUrl(url)
      })

      payWin.on('closed', () => {
        if (!handled) {
          resolve({ success: false, canceled: true })
        }
      })
    })
  }
}

module.exports = new PayPalService()
