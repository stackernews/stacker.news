const path = require('path')
const crypto = require('crypto')
const ws = require('ws')
const { TextEncoder, TextDecoder } = require('util')
const { performance } = require('perf_hooks')

// Init context
globalThis.WebSocket = ws
globalThis.path = path
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder
globalThis.performance = performance
globalThis.crypto = crypto
globalThis.lncInternalContext = true
// ---

const LNC = require('@lightninglabs/lnc-web').default

// Send multiple actions per message
// if one action fails, the whole message fails
// message : {
//    credentials: {},
//    serverHost: '',
//    actions :[
//      { // action 1
//        action: 'withPerms',
//        args: {}
//      }
//      { // action 2
//        action: 'addInvoice',
//        args: {}
//      } // ...
// }
// response : {
//    status: 'ok' | 'error',
//    error: 'error message',
//    credentials: {}, // updated credentials
//    results: [
//      {
//        action: 'withPerms',
//        result: {}
//      },
//      {
//        action: 'addInvoice',
//        result: {}
//      }
//    ]
process.on('message', async (message) => {
  const { credentials, actions } = message

  const out = {
    credentials: {},
    results: [],
    status: 'ok',
    error: undefined
  }

  try {
    // initialize LNC connection
    const lnc = await connect(credentials)
    // transfer updated credentials
    out.credentials = lnc.credentials.credentials

    // execute all actions
    for (const action of actions) {
      const actionOut = { action: action.action }
      out.results.push(actionOut)
      if (action.action === 'addInvoice') {
        actionOut.result = await lnc.lnd.lightning.addInvoice(action.args)
      } else if (action.action === 'withPerms') {
        actionOut.result = true
        for (const perm of action.args) {
          actionOut.result &&= lnc.hasPerms(perm)
          if (!actionOut.result) {
            throw new Error('missing permission: ' + perm)
          }
        }
      } else if (action.action === 'withoutPerms') {
        actionOut.result = true
        for (const perm of action.args) {
          actionOut.result &&= !lnc.hasPerms(perm)
          if (!actionOut.result) {
            throw new Error('unexpected permission: ' + perm)
          }
        }
      } else {
        throw new Error('Unknown action: ' + action.action)
      }
    }
  } catch (error) {
    out.status = 'error'
    out.error = error.message || error
  }

  // send results
  process.send(out)

  // finalize
  try {
    await finalize()
  } catch (e) {
    console.error('LNC(worker): Error while finalizing: ', e)
  }
})

async function connect (credentials) {
  const lnc = new LNC({
    credentialStore: new LncCredentialStore(credentials)
  })

  await lnc.connect()
  while (true) {
    if (lnc.isConnected) break
    console.info('LNC(worker): LNC is not ready yet...waiting...')
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  console.info('LNC(worker): LNC is connected')
  return lnc
}

async function finalize (lnc) {
  if (lnc && lnc.isConnected) {
    try {
      console.log('LNC(worker): disconnecting...')
      if (lnc.isConnected) lnc.disconnect()
      await new Promise((resolve, reject) => {
        let counter = 0
        const interval = setInterval(() => {
          if (lnc.isConnected) {
            if (counter++ > 100) {
              console.error('LNC(worker): failed to disconnect from lnc')
              clearInterval(interval)
              reject(new Error('failed to disconnect from lnc'))
            }
            return
          }
          clearInterval(interval)
          resolve()
        }, 100)
      })
    } catch (e) {
      console.error('LNC(worker): Error while disconnecting: ', e)
    }
  }
  process.exit(0)
}

class LncCredentialStore {
  credentials = {
    localKey: '',
    remoteKey: '',
    pairingPhrase: '',
    serverHost: ''
  }

  constructor (credentials = {}) {
    this.credentials = { ...this.credentials, ...credentials }
  }

  get password () {
    return ''
  }

  set password (password) { }

  get serverHost () {
    return this.credentials.serverHost
  }

  set serverHost (host) {
    this.credentials.serverHost = host
  }

  get pairingPhrase () {
    return this.credentials.pairingPhrase
  }

  set pairingPhrase (phrase) {
    this.credentials.pairingPhrase = phrase
  }

  get localKey () {
    return this.credentials.localKey
  }

  set localKey (key) {
    this.credentials.localKey = key
  }

  get remoteKey () {
    return this.credentials.remoteKey
  }

  set remoteKey (key) {
    this.credentials.remoteKey = key
  }

  get isPaired () {
    return !!this.credentials.remoteKey || !!this.credentials.pairingPhrase
  }

  clear () {
    this.credentials = {}
  }
}
