import { assertContentTypeJson, assertResponseOk } from '@/lib/url'
import { fetch } from 'cross-fetch'
import https from 'https'
export * from 'wallets/lnc'

export async function testCreateInvoice (credentials, { signal }) {
  await checkPerms(credentials, { signal })
  return await createInvoice({ msats: 1000, expiry: 1 }, credentials, { signal })
}

export async function createInvoice ({ msats, description, expiry }, credentials, { signal }) {
  const result = await rpcCall(credentials, 'lnrpc.Lightning.AddInvoice', { memo: description, valueMsat: msats, expiry }, { signal })
  return result.payment_request
}

async function checkPerms (credentials, { signal }) {
  const enforcePerms = [
    { 'lnrpc.Lightning.SendPaymentSync': false },
    { 'lnrpc.Lightning.AddInvoice': true },
    { 'lnrpc.Wallet.SendCoins': false }
  ]

  const results = await rpcCall(credentials, 'checkPerms', enforcePerms.map(perm => Object.keys(perm)[0]), { signal })
  for (let i = 0; i < enforcePerms.length; i++) {
    const [key, expected] = Object.entries(enforcePerms[i])[0]
    const result = results[i]
    if (result !== expected) {
      if (expected) {
        throw new Error(`missing permission: ${key}`)
      } else {
        throw new Error(`too broad permission: ${key}`)
      }
    }
  }
}

async function rpcCall (credentials, method, payload, { signal }) {
  const fetchArgs = {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Connection: {
        Mailbox: credentials.serverHostRecv || 'mailbox.terminal.lightning.today:443',
        PairingPhrase: credentials.pairingPhraseRecv,
        LocalKey: credentials.localKeyRecv,
        RemoteKey: credentials.remoteKeyRecv
      },
      Method: method,
      Payload: JSON.stringify(payload)
    })
  }

  // auth
  if (process.env.LNCD_AUTH_TOKEN) {
    fetchArgs.headers.Authorization = `Bearer ${process.env.LNCD_AUTH_TOKEN}`
  }

  // self-signed cert support
  if (process.env.LNCD_URL.startsWith('https://') && process.env.LNCD_CERT) {
    const cert = Buffer.from(process.env.LNCD_CERT, 'hex').toString('utf-8')
    const agent = new https.Agent({
      ca: cert,
      cert,
      rejectUnauthorized: false
    })
    fetchArgs.agent = agent
  }

  let res = await fetch(process.env.LNCD_URL + '/rpc', fetchArgs)

  assertResponseOk(res)
  assertContentTypeJson(res)

  res = await res.json()

  // cache auth credentials
  credentials.localKeyRecv = res.Connection.LocalKey
  credentials.remoteKeyRecv = res.Connection.RemoteKey
  credentials.serverHostRecv = res.Connection.Mailbox

  const result = JSON.parse(res.Result)
  return result
}
