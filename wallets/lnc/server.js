import { withTimeout } from '@/lib/time'
import { computePerms } from 'wallets/lnc'
import { Mutex } from 'async-mutex'
import { fork } from 'child_process'
import pg from 'pg'
import { fileURLToPath } from 'url'
import path from 'path'
import crypto from 'crypto'
export * from 'wallets/lnc'

// if true = each wallet can run in parallel with others
// if false = wallet requests are serialized
const PARALLEL = true

// if true = use a single session is used for all calls
// if false = use a new session for each call
const SINGLE_SESSION = true

export async function testCreateInvoice (credentials) {
  const timeout = 60_000 // high timeout due to lnc startup time
  return await withTimeout(createInvoice({ msats: 1000, expiry: 1 }, credentials), timeout)
}

export async function createInvoice ({ msats, description, expiry }, credentials) {
  const mutex = getMutex(credentials.pairingPhraseRecv)

  return await mutex.runExclusive(async () => {
    const lockId = credentials.pairingPhraseRecv
    let lock
    try {
      lock = await waitAndAcquireLock(lockId)

      const { expectedPerms, unexpectedPerms } = computePerms({ canReceive: true })

      const ipcCall = {
        credentials: {
          localKey: credentials.localKeyRecv,
          remoteKey: credentials.remoteKeyRecv,
          pairingPhrase: credentials.pairingPhraseRecv,
          serverHost: credentials.serverHostRecv || 'mailbox.terminal.lightning.today:443'
        },
        actions: [
          {
            action: 'withPerms',
            args: expectedPerms
          },
          {
            action: 'withoutPerms',
            args: unexpectedPerms
          },
          {
            action: 'addInvoice',
            args: { memo: description, valueMsat: msats, expiry }
          }
        ]
      }

      const ipcRes = await runInWorker(ipcCall)
      if (ipcRes.error) throw new Error(ipcRes.error)

      const newCredentials = ipcRes.credentials
      const result = ipcRes.results[2].result
      credentials.localKeyRecv = newCredentials.localKey
      credentials.remoteKeyRecv = newCredentials.remoteKey
      credentials.serverHostRecv = newCredentials.serverHost
      if (globalThis.lncInternalContext) throw new Error('Internal context leaked')
      const paymentRequest = result.paymentRequest
      if (!paymentRequest) throw new Error('No payment request in response')
      return paymentRequest
    } finally {
      if (lock) {
        await releaseLock(lock)
      }
    }
  })
}

let pgClient
const mutexes = []

async function runInWorker (ipcCall, timeout = 15_000) {
  return new Promise((resolve, reject) => {
    const dirname = path.dirname(fileURLToPath(import.meta.url))
    const workerPath = path.join(dirname, 'worker.cjs')
    const worker = fork(workerPath, [], {
      cwd: dirname,
      stdio: 'inherit'
    })

    const watchdog = setTimeout(() => {
      worker.kill('SIGKILL')
      reject(new Error('LNC subprocess timed out (killed by watchdog)'))
    }, timeout)

    worker.on('message', (msg) => {
      clearTimeout(watchdog)
      resolve(msg)
    })
    worker.on('error', (err) => {
      clearTimeout(watchdog)
      reject(err)
    })
    worker.on('exit', (code) => {
      clearTimeout(watchdog)
      if (code !== 0) {
        reject(new Error(`LNC subprocess exited with code ${code}`))
      }
    })
    worker.send(ipcCall)
  })
}

async function waitAndAcquireLock (key, timeout = 60_000) {
  const toAdvKey = (v) => {
    const hash = crypto.createHash('sha256').update(v).digest()
    const n1 = hash.readInt32BE(0)
    const n2 = hash.readInt32BE(4)
    return [n1, n2]
  }
  key = toAdvKey('lnc-' + key)
  const connectionUrl = process.env.DATABASE_URL
  let client = SINGLE_SESSION ? pgClient : undefined
  if (!client) {
    client = new pg.Client({ connectionString: connectionUrl })

    // close the client on nodejs exit
    const onExit = async () => {
      await client.end()
    }
    process.on('exit', onExit)
    client.on('end', () => {
      process.off('exit', onExit)
    })

    await client.connect()

    if (SINGLE_SESSION) {
      // reset on end (for reconnection)
      client.on('end', () => {
        pgClient = undefined
      })

      pgClient = client
    }
  }

  if (PARALLEL && SINGLE_SESSION) {
    // if parallel mode: we use polling to acquire the lock with pg_try_advisory_lock
    // this prevents the session from blocking while waiting for the lock
    let acquired = false
    const startTime = Date.now()
    while (!acquired) {
      if (Date.now() - startTime > timeout) {
        throw new Error('System is busy, please try again later (lock-timeout)')
      }
      const res = await client.query('SELECT pg_try_advisory_lock($1, $2)', key)
      if (res.rows[0].pg_try_advisory_lock) {
        acquired = true
      } else {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  } else {
    // if serial mode: we use pg_advisory_lock to acquire the lock, we just lock the session until we get it
    await client.query('SELECT pg_advisory_lock($1, $2)', key)
  }
  return { client, key }
}

async function releaseLock (lock) {
  const { client, key } = lock
  try {
    await client.query('SELECT pg_advisory_unlock($1, $2)', key)
  } catch (e) {
    // could happen if the client lost the connection
    console.error('Error releasing lock', e)
  }

  // close the client if not in single session mode
  if (!SINGLE_SESSION) {
    await client.end()
  }
}

function getMutex (key, mutexTimeout = 120_000) {
  if (PARALLEL) {
    // in parallel mode we use a list of mutexes
    // one mutex per wallet
    let mutex
    for (let i = 0; i < mutexes.length; i++) {
      const v = mutexes[i]
      if (!v.mutex.isLocked() && Date.now() - v.lastAccess > mutexTimeout) {
        // clear unused mutexes
        mutexes.splice(i, 1)
        i--
      } else if (v.key === key) {
        mutex = v
      }
    }
    if (!mutex) {
      mutex = new Mutex()
      mutexes.push({
        mutex,
        lastAccess: Date.now(),
        key
      })
    } else {
      mutex.lastAccess = Date.now()
      mutex = mutex.mutex
    }
    return mutex
  } else {
    // in serial mode we use a single mutex
    let mutex = mutexes['mutex.sync']
    if (!mutex) {
      mutex = new Mutex()
      mutexes['mutex.sync'] = {
        mutex,
        lastAccess: Date.now(),
        key
      }
    } else {
      mutex = mutex.mutex
    }
    return mutex
  }
}
