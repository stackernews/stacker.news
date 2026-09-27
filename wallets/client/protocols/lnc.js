import { Mutex } from 'async-mutex'
import { walletAmountToMsatsOrUndefined, walletAmountToSats } from '@/wallets/lib/amount'
import { isAbortLike, raceAbort, throwIfAborted } from '@/lib/time'
import { WalletPaymentRejectedError, WalletPermissionsError, WalletBalanceProbeSkipped } from '@/wallets/client/errors'
import { verificationUnsupportedResult } from '@/wallets/lib/external-transactions'
import { walletBalance } from './util'

export const name = 'LNC'
// LND enforces routing fee caps via fee_limit_sat on SendPaymentV2.
export const enforcesMaxFee = true

const serverHost = 'mailbox.terminal.lightning.today:443'
const LNC_SEND_PAYMENT_PERMISSION = 'routerrpc.Router.SendPaymentV2'
const LNC_CHANNEL_BALANCE_PERMISSION = 'lnrpc.Lightning.ChannelBalance'
const LNC_TRACK_PAYMENT_PERMISSION = 'routerrpc.Router.TrackPaymentV2'
const LNC_SEND_COINS_PERMISSION = 'lnrpc.Lightning.SendCoins'
// Sessions created before LND 0.21 still grant this removed method. Naming it in the
// permission error is what turns "my sends stopped working" into what to recreate.
const LNC_REMOVED_SEND_PAYMENT_PERMISSION = 'lnrpc.Lightning.SendPaymentSync'
// Disconnect an idle instance this long after the last call.
const IDLE_DISCONNECT_MS = 4000

export async function sendPayment (bolt11, credentials, { logger, maxFee, signal }) {
  return await connection.use(credentials, { logger, signal }, async lnc => {
    // Checked before the payment is attempted, so a session that cannot send is a
    // configuration problem, not a payment outcome (see the adapter classification
    // contract in ./index.js).
    if (!lnc.hasPerms(LNC_SEND_PAYMENT_PERMISSION)) {
      throw new WalletPermissionsError(sendPermissionHint(lnc))
    }
    const request = {
      paymentRequest: bolt11,
      // only the terminal update is useful here: the outcome is what the caller judges,
      // and LND then closes the stream on its own
      noInflightUpdates: true
    }
    if (maxFee != null) {
      if (!Number.isSafeInteger(maxFee) || maxFee < 0) {
        throw new Error(`invalid maxFee: ${maxFee}`)
      }
      // SendPaymentV2 caps the routing fee with fee_limit_sat (int64); serialize as a
      // string to avoid the 53-bit int safety ceiling. Leaving it unset makes LND
      // assume a zero-fee limit, which only considers routes without fees.
      request.feeLimitSat = String(maxFee)
    }
    // timeout_seconds is deliberately left unset: LND then applies its documented 60s
    // default, which is the deadline the old SendPaymentSync call got. A transport drop
    // after the RPC was transmitted may leave the payment in flight;
    // classifyWalletPaymentError treats such errors as UNKNOWN by default.
    const payment = await sendPaymentV2(lnc, request, { signal })
    if (!payment) {
      // the stream closed without an update, so the payment may still be in flight
      // or may have settled: TrackPaymentV2 in checkPayment resolves the true outcome
      return { status: 'UNKNOWN' }
    }
    if (!lndPaymentSucceeded(payment) && !lndPaymentFailed(payment)) {
      // an in-flight update, from a bridge that ignores noInflightUpdates
      return { status: 'UNKNOWN', detail: 'payment still in flight' }
    }
    if (lndPaymentFailed(payment)) {
      // FAILED is terminal for the payment lifecycle: every HTLC attempt resolved, so
      // LND itself reports the failure and a retry cannot double-pay. A missing reason
      // attributes nothing though, and stays ambiguous instead of claiming a failure.
      const reason = payment.failureReason ? String(payment.failureReason) : ''
      if (!reason || reason === 'FAILURE_REASON_NONE') {
        return { status: 'UNKNOWN', detail: 'lnd reports payment failed without a reason' }
      }
      throw new WalletPaymentRejectedError(reason)
    }
    // A successful provider response is authoritative even without proof.
    const { paymentPreimage: preimage } = payment
    if (!preimage) {
      return {
        status: 'SETTLED',
        actualFeeMsats: lndPaymentFeeMsats(payment)
      }
    }
    // downstream verifyPreimage does the shape check plus sha256 verification;
    // a malformed value should surface as "invalid proof of payment", not be dropped here
    const preimageHex = Buffer.from(preimage, 'base64').toString('hex')
    return {
      status: 'SETTLED',
      preimage: preimageHex,
      actualFeeMsats: lndPaymentFeeMsats(payment)
    }
  })
}

export async function testSendPayment (credentials, { logger, signal }) {
  return await connection.use(credentials, { logger, signal }, async lnc => {
    logger?.info('validating permissions ...')
    validateNarrowPerms(lnc)
    logger?.info('permissions ok')
    return lnc.credentials.credentials
  })
}

export async function checkPayment ({ hash }, credentials, { logger, signal }) {
  return await connection.use(credentials, { logger, signal }, async lnc => {
    // a send-only session deliberately omits TrackPaymentV2 (the field help endorses this), so
    // settlement can never be verified for it — classify as unsupported (stop polling, benign message)
    // rather than PERMISSION_REQUIRED, which would re-poll with a misleading "update wallet permissions" notice
    if (!lnc.hasPerms(LNC_TRACK_PAYMENT_PERMISSION)) {
      return verificationUnsupportedResult(`missing permission: ${LNC_TRACK_PAYMENT_PERMISSION}`)
    }

    const payment = await trackPayment(lnc, hash, { signal })
    if (!payment) return { status: 'PENDING' }

    if (lndPaymentSucceeded(payment)) {
      const { paymentPreimage: preimage } = payment
      return {
        status: 'SETTLED',
        preimage,
        actualFeeMsats: lndPaymentFeeMsats(payment)
      }
    }
    if (lndPaymentFailed(payment)) {
      const reason = payment.failureReason && String(payment.failureReason)
      return {
        status: 'FAILED',
        detail: reason && reason !== 'FAILURE_REASON_NONE' ? reason : 'lnd reports payment failed'
      }
    }

    return { status: 'PENDING' }
  })
}

export async function getBalance (credentials, { signal, logger } = {}) {
  // If a send is in progress, skip the probe so we don't keep `sendPayment`
  // waiting.
  if (connection.busy) throw new WalletBalanceProbeSkipped('balance probe skipped while lnc is busy')
  return await connection.use(credentials, { logger, signal }, async lnc => {
    if (!lnc.hasPerms(LNC_CHANNEL_BALANCE_PERMISSION)) return null

    const balance = await connection.call(lnc.lnd.lightning.channelBalance(), { logger, signal })
    // LND may return sat or msat shapes depending on the bridge version.
    return walletBalance(lndAmountToSats(balance.localBalance ?? balance.balance))
  })
}

async function trackPayment (lnc, hash, { signal }) {
  throwIfAborted(signal)

  // raceAbort owns cancellation, so the caller's timeout diagnosis propagates
  // instead of a fabricated bare 'aborted' error
  return await raceAbort(new Promise((resolve, reject) => {
    let done = false
    const paymentHash = Buffer.from(hash, 'hex').toString('base64')
    const request = {
      paymentHash,
      // in-flight updates make an existing payment answer immediately: the first
      // event resolves, and checkPayment maps non-terminal statuses to PENDING
      // instead of hanging until the caller's timeout aborts
      noInflightUpdates: false
    }

    const finish = (err, payment) => {
      if (done) return
      done = true
      if (err) {
        const message = err?.message ?? err?.details ?? String(err)
        if (message.includes("payment isn't initiated") || message.includes('SentPaymentNotFound')) return resolve(null)
        return reject(err)
      }
      resolve(payment)
    }
    try {
      lnc.lnd.router.trackPaymentV2(request, payment => finish(null, payment), err => finish(err))
    } catch (err) {
      finish(err)
    }
  }), signal)
}

// sendPaymentV2 is a stream (request in, payment updates out), like trackPaymentV2
// above, so it needs the same treatment: resolve the first update, let raceAbort own
// cancellation, and never invent a payment outcome from an abort.
async function sendPaymentV2 (lnc, request, { signal }) {
  throwIfAborted(signal)

  return await raceAbort(new Promise((resolve, reject) => {
    let done = false
    const finish = (err, payment) => {
      if (done) return
      done = true
      if (err) return reject(err)
      resolve(payment ?? null)
    }
    try {
      lnc.lnd.router.sendPaymentV2(request, payment => finish(null, payment), err => finish(err))
    } catch (err) {
      finish(err)
    }
  }), signal)
}

// Sole owner of the LNC connection lifecycle. lnc-web wraps a single global
// Go-WASM object that holds closures to the first LNC instance created, so
// the instance must be reused for the whole tab.
class LncConnection {
  mutex = new Mutex()
  // Set (never awaited inline) when an aborted call may have wedged the bridge.
  // connect() drains it before reconnecting, so teardown finishes off the mutex
  // instead of blocking the caller that aborted.
  pendingDisconnect = null

  get instance () { return window.snLnc ?? null }
  set instance (lnc) { window.snLnc = lnc }
  get creds () { return window.snLncCredentials }
  set creds (creds) { window.snLncCredentials = creds }
  get idleTimer () { return window.snLncKillerTimeout }
  set idleTimer (id) { window.snLncKillerTimeout = id }

  get busy () {
    return this.mutex.isLocked()
  }

  // Run `fn` with a connected instance, serialized against every other call.
  async use (credentials, { logger, signal }, fn) {
    const release = await this.acquire(signal)
    try {
      return await fn(await this.connect(credentials, { logger, signal }))
    } finally {
      release()
    }
  }

  // Acquire the mutex but honor abort. A mutex acquire can't be cancelled, so if
  // abort wins the race we release the lock once it finally resolves.
  async acquire (signal) {
    const pendingRelease = this.mutex.acquire()
    try {
      return await raceAbort(pendingRelease, signal)
    } catch (err) {
      if (isAbortLike(err)) pendingRelease.then(release => release()).catch(() => {})
      throw err
    }
  }

  // Ensure the singleton exists, holds `credentials`, and is connected.
  async connect (credentials = {}, { logger, signal } = {}) {
    throwIfAborted(signal)
    if (this.pendingDisconnect) {
      await this.pendingDisconnect
      this.pendingDisconnect = null
    }
    if (this.idleTimer) clearTimeout(this.idleTimer)

    if (!this.instance) { // create new instance
      const { default: LNC } = await raceAbort(import('@lightninglabs/lnc-web'), signal)
      throwIfAborted(signal)
      this.instance = new LNC({
        credentialStore: new LncCredentialStore({
          ...credentials,
          // litd sessions are only reachable through the mailbox they were created for;
          // prefer a stored custom mailbox over the Lightning Labs default
          serverHost: credentials.serverHost || serverHost
        })
      })

      window.addEventListener('beforeunload', () => {
        // try to disconnect gracefully when the page is closed
        this.disconnect({ logger })
      })
    } else if (JSON.stringify(this.creds ?? {}) !== JSON.stringify(credentials)) {
      // disconnect and update credentials if they've changed
      this.pendingDisconnect = this.disconnect({ logger }).catch(() => {})
      await raceAbort(this.pendingDisconnect, signal)
      this.pendingDisconnect = null
      // XXX we MUST reuse the same instance of LNC because it references a global Go object
      // that holds closures to the first LNC instance it's created with
      this.instance.credentials.credentials = {
        ...this.instance.credentials.credentials,
        ...credentials,
        serverHost: credentials.serverHost || serverHost
      }
    }

    if (!this.instance.isConnected) {
      logger?.info('connecting ...')
      await this.call(this.instance.connect(), { logger, signal })
      logger?.info('connected')
    }

    this.creds = { ...credentials }

    this.idleTimer = setTimeout(() => {
      this.mutex.runExclusive(() => this.disconnect()).catch(() => {})
    }, IDLE_DISCONNECT_MS)

    return this.instance
  }

  // Race an SDK promise against abort and rethrow.
  async call (promise, { logger, signal } = {}) {
    try {
      return await raceAbort(promise, signal)
    } catch (err) {
      // The LNC Go/WASM bridge can leave the singleton wedged after an aborted
      // connect/RPC, so tear it down before allowing future calls to reuse it.
      // Don't await here — connect() drains pendingDisconnect before reconnecting,
      // so the disconnect completes before the next connect without holding the mutex.
      if (isAbortLike(err)) {
        this.pendingDisconnect = this.disconnect({ logger, force: true }).catch(() => {})
      }
      throw err
    }
  }

  async disconnect ({ logger, force = false } = {}) {
    const lnc = this.instance
    try {
      if (!lnc) return
      if (!lnc.isConnected) {
        if (force) lnc.disconnect()
        return
      }
      lnc.disconnect()
      logger?.info('disconnecting...')
      // wait for lnc to disconnect
      await new Promise((resolve, reject) => {
        let counter = 0
        const interval = setInterval(() => {
          if (lnc?.isConnected) {
            if (counter++ > 100) {
              logger?.error('failed to disconnect from lnc')
              clearInterval(interval)
              reject(new Error('failed to disconnect from lnc'))
            }
            return
          }
          clearInterval(interval)
          resolve()
        }, 50)
      })
      logger?.info('disconnected')
    } catch (err) {
      logger?.error('failed to disconnect from lnc: ' + err)
    }
  }
}

const connection = new LncConnection()

// A session paired before LND 0.21 only grants the removed SendPaymentSync, which is
// why sending stopped working: say so, because "missing permission" alone does not tell
// the user that the fix is to recreate the session rather than to re-pair the same one.
function sendPermissionHint (lnc) {
  if (lnc.hasPerms(LNC_REMOVED_SEND_PAYMENT_PERMISSION)) {
    return `missing permission: ${LNC_SEND_PAYMENT_PERMISSION} — this session still ` +
      `grants ${LNC_REMOVED_SEND_PAYMENT_PERMISSION}, which LND 0.21 removed; ` +
      'recreate the session with the new permissions'
  }
  return `missing permission: ${LNC_SEND_PAYMENT_PERMISSION}`
}

function validateNarrowPerms (lnc) {
  if (!lnc.hasPerms(LNC_SEND_PAYMENT_PERMISSION)) {
    throw new WalletPermissionsError(sendPermissionHint(lnc))
  }
  if (lnc.hasPerms(LNC_SEND_COINS_PERMISSION)) {
    throw new WalletPermissionsError(`too broad permission: ${LNC_SEND_COINS_PERMISSION}`)
  }
  // TODO: need to check for more narrow permissions
  // blocked by https://github.com/lightninglabs/lnc-web/issues/112
}

// default credential store can go fuck itself
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

// LND PaymentStatus: numeric enum from the gRPC bridge or string from lnc-web
const lndPaymentSucceeded = payment =>
  payment?.status === 2 || String(payment?.status).toUpperCase() === 'SUCCEEDED'
const lndPaymentFailed = payment =>
  payment?.status === 3 || String(payment?.status).toUpperCase() === 'FAILED'

function lndAmountToSats (amount) {
  try {
    return walletAmountToSats(amount)
  } catch {
    return null
  }
}

function lndPaymentFeeMsats (payment) {
  const route = payment.paymentRoute
  // two chained calls so a present-but-malformed msat field still falls back to sats
  return walletAmountToMsatsOrUndefined(payment.feeMsat ?? route?.totalFeesMsat) ??
    walletAmountToMsatsOrUndefined({ sat: payment.feeSat ?? payment.fee ?? route?.totalFees })
}
