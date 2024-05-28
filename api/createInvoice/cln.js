import fetch from 'cross-fetch'
import https from 'https'
import crypto from 'crypto'
import { HttpProxyAgent, HttpsProxyAgent } from '@/api/createInvoice/http-proxy-agent'

export default async function createInvoice ({ socket, rune, cert }, { label, description, msats, expiry }) {
  let protocol, agent
  const httpsAgentOptions = { ca: cert ? Buffer.from(cert, 'base64') : undefined }
  const isOnion = /\.onion(:[0-9]+)?$/.test(socket)
  if (isOnion) {
    // we support HTTP and HTTPS over Tor
    protocol = cert ? 'https:' : 'http:'
    // we need to use our Tor proxy to resolve onion addresses
    const proxyOptions = { proxy: process.env.TOR_PROXY }
    agent = protocol === 'https:'
      ? new HttpsProxyAgent({ ...proxyOptions, ...httpsAgentOptions, rejectUnauthorized: false })
      : new HttpProxyAgent(proxyOptions)
  } else {
    // we only support HTTPS over clearnet
    agent = new https.Agent(httpsAgentOptions)
    protocol = 'https:'
  }

  const url = `${protocol}//${socket}/v1/invoice`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Rune: rune,
      // can be any node id, only required for CLN v23.08 and below
      // see https://docs.corelightning.org/docs/rest#server
      nodeId: '02cb2e2d5a6c5b17fa67b1a883e2973c82e328fb9bd08b2b156a9e23820c87a490'
    },
    agent,
    body: JSON.stringify({
      // CLN requires a unique label for every invoice
      // see https://docs.corelightning.org/reference/lightning-invoice
      label: crypto.randomBytes(16).toString('hex'),
      description,
      amount_msat: msats,
      expiry
    })
  })
  const inv = await res.json()
  if (inv.error) {
    throw new Error(inv.error.message)
  }
  return inv
}
