/* eslint-env serviceworker */
/* global self */

// OAuth Service Worker for handling wallet notifications
// This allows OAuth apps to receive payment notifications even when not in focus

const STACKER_NEWS_ORIGIN = self.location.origin

// Cache for OAuth access tokens and app info
let oauthAppInfo = null
let accessToken = null

// Listen for messages from the main application
self.addEventListener('message', async (event) => {
  const { type, data } = event.data

  switch (type) {
    case 'OAUTH_INIT':
      oauthAppInfo = data.appInfo
      accessToken = data.accessToken
      console.log('OAuth Service Worker initialized for app:', oauthAppInfo.name)
      break

    case 'OAUTH_PAYMENT_REQUEST':
      await handlePaymentRequest(data)
      break

    case 'OAUTH_INVOICE_REQUEST':
      await handleInvoiceRequest(data)
      break

    default:
      console.log('Unknown message type:', type)
  }
})

// Listen for push notifications from Stacker News server
self.addEventListener('push', async (event) => {
  if (!event.data) return

  try {
    const notification = event.data.json()

    if (notification.type === 'oauth_payment_approval_required') {
      await handlePaymentApprovalRequired(notification)
    } else if (notification.type === 'oauth_invoice_paid') {
      await handleInvoicePaid(notification)
    } else if (notification.type === 'oauth_payment_completed') {
      await handlePaymentCompleted(notification)
    }
  } catch (error) {
    console.error('Error handling push notification:', error)
  }
})

// Handle payment requests from OAuth apps
async function handlePaymentRequest (paymentData) {
  try {
    const response = await fetch(`${STACKER_NEWS_ORIGIN}/api/oauth/wallet/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    })

    const result = await response.json()

    // Send result back to the OAuth app
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'OAUTH_PAYMENT_RESPONSE',
        data: result,
        requestId: paymentData.requestId
      })
    })

    // If approval is required, show notification
    if (result.status === 'pending_approval') {
      await self.registration.showNotification('Payment Approval Required', {
        body: `${oauthAppInfo.name} wants to send ${result.amount_sats} sats`,
        icon: '/bitcoin-logo.png',
        badge: '/bitcoin-logo.png',
        tag: `payment-approval-${result.payment_id}`,
        requireInteraction: true,
        actions: [
          { action: 'approve', title: 'Approve' },
          { action: 'deny', title: 'Deny' }
        ],
        data: {
          type: 'payment_approval',
          paymentId: result.payment_id,
          appName: oauthAppInfo.name
        }
      })
    }
  } catch (error) {
    console.error('Error handling payment request:', error)
  }
}

// Handle invoice creation requests
async function handleInvoiceRequest (invoiceData) {
  try {
    const response = await fetch(`${STACKER_NEWS_ORIGIN}/api/oauth/wallet/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    })

    const result = await response.json()

    // Send result back to the OAuth app
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'OAUTH_INVOICE_RESPONSE',
        data: result,
        requestId: invoiceData.requestId
      })
    })
  } catch (error) {
    console.error('Error handling invoice request:', error)
  }
}

// Handle payment approval required notifications
async function handlePaymentApprovalRequired (notification) {
  await self.registration.showNotification('Payment Approval Required', {
    body: `${notification.appName} wants to send ${notification.amountSats} sats`,
    icon: '/bitcoin-logo.png',
    badge: '/bitcoin-logo.png',
    tag: `payment-approval-${notification.paymentId}`,
    requireInteraction: true,
    actions: [
      { action: 'approve', title: 'Approve' },
      { action: 'deny', title: 'Deny' }
    ],
    data: {
      type: 'payment_approval',
      paymentId: notification.paymentId,
      appName: notification.appName
    }
  })
}

// Handle invoice paid notifications
async function handleInvoicePaid (notification) {
  await self.registration.showNotification('Invoice Paid', {
    body: `Received ${notification.amountSats} sats from ${notification.appName}`,
    icon: '/bitcoin-logo.png',
    badge: '/bitcoin-logo.png',
    tag: `invoice-paid-${notification.invoiceId}`,
    data: {
      type: 'invoice_paid',
      invoiceId: notification.invoiceId,
      appName: notification.appName
    }
  })

  // Notify the OAuth app
  const clients = await self.clients.matchAll()
  clients.forEach(client => {
    client.postMessage({
      type: 'OAUTH_INVOICE_PAID',
      data: notification
    })
  })
}

// Handle payment completed notifications
async function handlePaymentCompleted (notification) {
  await self.registration.showNotification('Payment Sent', {
    body: `Sent ${notification.amountSats} sats via ${notification.appName}`,
    icon: '/bitcoin-logo.png',
    badge: '/bitcoin-logo.png',
    tag: `payment-sent-${notification.paymentId}`,
    data: {
      type: 'payment_completed',
      paymentId: notification.paymentId,
      appName: notification.appName
    }
  })

  // Notify the OAuth app
  const clients = await self.clients.matchAll()
  clients.forEach(client => {
    client.postMessage({
      type: 'OAUTH_PAYMENT_COMPLETED',
      data: notification
    })
  })
}

// Handle notification clicks
self.addEventListener('notificationclick', async (event) => {
  event.notification.close()

  const { type, paymentId } = event.notification.data

  if (type === 'payment_approval') {
    if (event.action === 'approve') {
      // Open approval page
      await self.clients.openWindow(`${STACKER_NEWS_ORIGIN}/oauth/approve-payment/${paymentId}`)
    } else if (event.action === 'deny') {
      // Send denial to server
      try {
        await fetch(`${STACKER_NEWS_ORIGIN}/api/oauth/wallet/approve-payment/${paymentId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ approved: false })
        })
      } catch (error) {
        console.error('Error denying payment:', error)
      }
    } else {
      // Default click - open approval page
      await self.clients.openWindow(`${STACKER_NEWS_ORIGIN}/oauth/approve-payment/${paymentId}`)
    }
  } else {
    // For other notification types, just focus or open the main app
    const existingClients = await self.clients.matchAll()
    if (existingClients.length > 0) {
      existingClients[0].focus()
    } else {
      await self.clients.openWindow(STACKER_NEWS_ORIGIN)
    }
  }
})

// Clean up old notifications
self.addEventListener('notificationclose', (event) => {
  // Could implement cleanup logic here if needed
})

// Install event
self.addEventListener('install', (event) => {
  console.log('OAuth Service Worker installed')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('OAuth Service Worker activated')
  event.waitUntil(self.clients.claim())
})
