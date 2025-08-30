import { SimplePool, generateSecretKey, getPublicKey, nip44, nip04, finalizeEvent, verifyEvent, sha256 } from 'nostr-tools'

function now () { return Math.floor(Date.now() / 1000) }

function minePow (event, targetDifficulty = 28) {
  let nonce = 0
  const maxIterations = 1000000 // Limit to avoid infinite loops

  while (nonce < maxIterations) {
    const nonceTag = ['nonce', nonce.toString(), targetDifficulty.toString()]
    const eventWithNonce = {
      ...event,
      tags: [...event.tags, nonceTag]
    }
    // Calculate event hash without signature
    const eventHash = getEventHash(eventWithNonce)
    // Check if hash meets the required difficulty
    if (countLeadingZeros(eventHash) >= targetDifficulty) {
      return eventWithNonce
    }
    nonce++
  }
  throw new Error(`Unable to find proof-of-work with difficulty ${targetDifficulty} in ${maxIterations} iterations`)
}

// Function to calculate event hash (simplified)
function getEventHash (event) {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ])

  // Use a hash function (you should import sha256 from nostr-tools)
  return sha256(new TextEncoder().encode(serialized))
}

// Function to count leading zeros in hexadecimal
function countLeadingZeros (hex) {
  let count = 0
  for (let i = 0; i < hex.length; i++) {
    if (hex[i] === '0') {
      count += 4 // Each hex character represents 4 bits
    } else {
      // Count zero bits in the first non-zero character
      const char = parseInt(hex[i], 16)
      if (char < 8) count += 1
      if (char < 4) count += 1
      if (char < 2) count += 1
      break
    }
  }
  return count
}
// for QR login (nostrconnect://)
export default class NostrConnectSession {
  constructor ({ relays, metadata = { name: 'Stacker News' }, perms = ['sign_event:27235'] } = {}) {
    // Normalize relays coming from options or env to always be a string[]
    const normalizeRelays = (r) => {
      if (Array.isArray(r)) return r.map(s => String(s)).filter(Boolean)
      if (typeof r === 'string') {
        // allow comma-separated or single url
        return r.split(',').map(s => s.trim()).filter(Boolean)
      }
      return null
    }

    if (!relays) {
      const envRelays = process.env.NEXT_PUBLIC_NOSTR_CONNECT_RELAYS
      if (envRelays) {
        relays = normalizeRelays(envRelays)
      } else {
        // More reliable and NIP-46-specific relays
        relays = [
          'wss://relay.damus.io',
          'wss://nos.lol',
          'wss://relay.nostr.band',
          'wss://relay.nostrgraph.net',
          'wss://nostr.wine'
        ]
      }
    }
    this.relays = normalizeRelays(relays) || ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band']

    this.pool = new SimplePool()
    this.appSk = generateSecretKey()
    this.appPk = getPublicKey(this.appSk)
    // required secret (per NIP-46) and standard query params
    this.secret = (typeof crypto !== 'undefined' && crypto?.getRandomValues)
      ? (() => { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map(x => x.toString(16).padStart(2, '0')).join('') })()
      : Math.random().toString(36).slice(2)
    // NIP-46 connect URI scanned by remote signer apps (e.g., Amber)
    const relayParams = this.relays.map(r => `relay=${encodeURIComponent(r)}`).join('&')
    const qp = [
      relayParams,
      `name=${encodeURIComponent(metadata?.name || 'Stacker News')}`,
      metadata?.url ? `url=${encodeURIComponent(metadata.url)}` : null,
      perms?.length ? `perms=${encodeURIComponent(perms.join(','))}` : null,
      `secret=${encodeURIComponent(this.secret)}`
    ].filter(Boolean).join('&')
    this.uri = `nostrconnect://${this.appPk}?${qp}`
    this.sub = null
    this.signerPk = null
    this.pendingReqId = null
    // prefer nip44, fallback to nip04 if signer uses it
    this.cipher = 'nip44'
    this._closed = false
    this.pendingGetReqId = null
    this.userPubkey = null
  }

  async startWithChallenge (challengeTags, { onSigned, timeoutMs = 120000, onStatus } = {}) {
    // Closes any previous sessions
    if (this.sub) {
      try { this.sub.close() } catch {}
    }

    this.onStatus = typeof onStatus === 'function' ? onStatus : null
    // Subscribe to NIP-46 request/response events addressed to our app pubkey
    const filters = [{ kinds: [24133], '#p': [this.appPk] }]

    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        this.onStatus && this.onStatus('timeout')
        this.close()
      }
    }, timeoutMs)

    this.onStatus && this.onStatus('listening')

    this.sub = this.pool.subscribeMany(this.relays, filters, {
      onevent: async (ev) => {
        // Skip events not directed to us - strict check
        const pTag = ev.tags.find(tag => tag[0] === 'p' && tag.length >= 2)
        if (!pTag || pTag[1] !== this.appPk) {
          return
        }

        if (!ev.content || typeof ev.content !== 'string') {
          return
        }
        try {
          const from = ev.pubkey
          let plaintext

          // Try NIP-04 first
          try {
            plaintext = await nip04.decrypt(this.appSk, from, ev.content)
            this.cipher = 'nip04'
          } catch (nip04Error) {
            try {
              // Try NIP-44
              const convKey = nip44.getConversationKey(this.appSk, from)
              plaintext = nip44.decrypt(ev.content, convKey)
              this.cipher = 'nip44'
            } catch (nip44Error) {
              throw new Error(`Decryption failed: ${nip04Error.message}`)
            }
          }

          if (!plaintext) {
            throw new Error('Failed to decrypt message')
          }
          const msg = JSON.parse(plaintext)
          // 1) Remote signer may initiate with a connect RESPONSE: result may be our secret, 'ack' or 'ok'
          if (msg && (msg.result === this.secret || msg.result === 'ack' || msg.result === 'ok')) {
            this.signerPk = from
            this.onStatus && this.onStatus('connected', msg.result)
            // proceed to request signature
            await this.#requestGetPubkey()
            return
          }
          // 2) Some signers send a connect REQUEST; ACK it and proceed
          if (msg?.method === 'connect' && msg?.id) {
            this.signerPk = from
            await this.#sendRpcResponse(from, { id: msg.id, result: this.secret || 'ack' })
            this.onStatus && this.onStatus('connect-request')
            await this.#requestGetPubkey()
            return
          }
          // 2.5) Response to our get_public_key request
          if (msg?.id && msg.id === this.pendingGetReqId && msg.result) {
            this.userPubkey = typeof msg.result === 'string' ? msg.result : String(msg.result)
            this.onStatus && this.onStatus('got-pubkey')
            this.pendingGetReqId = null
            await this.#requestSign(challengeTags)
            return
          }
          // 3) Response to our sign_event request
          if (msg?.id && msg.id === this.pendingReqId && msg.result) {
            let signedEvent = msg.result
            // result may be a stringified JSON per spec
            if (typeof signedEvent === 'string') {
              try { signedEvent = JSON.parse(signedEvent) } catch {}
            }
            const ok = signedEvent && verifyEvent(signedEvent)
            if (ok) {
              done = true
              clearTimeout(timer)
              this.close()
              this.onStatus && this.onStatus('signed')
              onSigned && onSigned(signedEvent)
            } else {
              this.onStatus && this.onStatus('error', 'Event verification failed')
            }
          }
        } catch (e) {
          // ignore non-JSON or non-target messages
          this.onStatus && this.onStatus('error', e?.message || String(e))
        }
      }
    })
  }

  async #requestSign (challengeTags) {
    if (!this.signerPk) return
    let eventToSign = {
      kind: 27235,
      created_at: now(),
      tags: challengeTags,
      content: 'Stacker News Authentication'
    }
    // Add proof-of-work if necessary
    try {
      this.onStatus && this.onStatus('mining-pow')
      eventToSign = minePow(eventToSign, 28)
      this.onStatus && this.onStatus('pow-complete')
    } catch (error) {
      this.onStatus && this.onStatus('pow-failed', error.message)
      // Continue without POW if it fails
    }
    const reqId = (typeof crypto !== 'undefined' && crypto?.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2)
    const req = { id: reqId, method: 'sign_event', params: [JSON.stringify(eventToSign)] }
    this.pendingReqId = reqId
    this.onStatus && this.onStatus('requesting-signature')
    await this.#sendRpc(this.signerPk, req)
  }

  async #requestGetPubkey () {
    if (!this.signerPk) return
    const reqId = (typeof crypto !== 'undefined' && crypto?.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2)
    const req = { id: reqId, method: 'get_public_key', params: [] }
    this.pendingGetReqId = reqId
    this.onStatus && this.onStatus('requesting-pubkey')
    await this.#sendRpc(this.signerPk, req)
  }

  async #sendRpc (toPubkey, req) {
    // Always use a fresh copy of the relays array to avoid corruption
    const relaysToUse = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band']

    const payload = JSON.stringify(req)
    let content
    if (this.cipher === 'nip04') {
      content = await nip04.encrypt(this.appSk, toPubkey, payload)
    } else {
      const convKey = nip44.getConversationKey(this.appSk, toPubkey)
      content = nip44.encrypt(payload, convKey)
    }
    const ev = {
      kind: 24133,
      created_at: now(),
      tags: [['p', toPubkey]],
      content,
      pubkey: this.appPk
    }
    const signed = finalizeEvent(ev, this.appSk)
    try {
      // SimplePool.publish() wants an array of relays, not individual relay strings
      await this.pool.publish(relaysToUse, signed)
    } catch (error) {
      console.error('[ERROR] Failed to publish:', error)
      throw error
    }
  }

  async #sendRpcResponse (toPubkey, res) {
    // Always use a fresh copy of the relays array to avoid corruption
    const relaysToUse = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band']

    const payload = JSON.stringify(res)
    let content
    if (this.cipher === 'nip04') {
      content = await nip04.encrypt(this.appSk, toPubkey, payload)
    } else {
      const convKey = nip44.getConversationKey(this.appSk, toPubkey)
      content = nip44.encrypt(payload, convKey)
    }
    const ev = {
      kind: 24133,
      created_at: now(),
      tags: [['p', toPubkey]],
      content,
      pubkey: this.appPk
    }
    const signed = finalizeEvent(ev, this.appSk)
    // SimplePool.publish() wants an array of relays, not individual relay strings
    await this.pool.publish(relaysToUse, signed)
  }

  close () {
    if (this._closed) return
    this._closed = true
    try { this.sub?.close?.() } catch {}
    // We do not aggressively close the shared pool connections in development
    try { this.onStatus && this.onStatus('closed') } catch {}
  }
}
