import { withTimeout } from '@/lib/time'
import vm from 'vm'
import { checkPerms, LncCredentialStore } from 'wallets/lnc'
import { Mutex } from 'async-mutex'
export * from 'wallets/lnc'

const mutexes = {}

export async function testCreateInvoice (credentials) {
  const timeout = 15_000
  return await withTimeout(createInvoice({ msats: 1000, expiry: 1 }, credentials), timeout)
}

export async function createInvoice ({ msats, description, expiry }, credentials) {
  const mutexTimeout = 120_000
  let mutex
  for (const [key, value] of Object.entries(mutexes)) {
    if (!value.mutex.isLocked() && Date.now() - value.lastAccess > mutexTimeout) {
      delete mutexes[key]
    } else if (key === credentials.pairingPhraseRecv) {
      mutex = value
    }
  }
  if (!mutex) {
    mutex = new Mutex()
    mutexes[credentials.pairingPhraseRecv] = {
      mutex,
      lastAccess: Date.now()
    }
  } else {
    mutex.lastAccess = Date.now()
    mutex = mutex.mutex
  }
  return await mutex.runExclusive(async () => {
    const lnc = await getLNC({
      localKey: credentials.localKeyRecv,
      remoteKey: credentials.remoteKeyRecv,
      pairingPhrase: credentials.pairingPhraseRecv,
      serverHost: credentials.serverHostRecv
    })
    try {
      await lnc.connect()
      checkPerms(lnc, { canReceive: true })
      const result = await lnc.lnd.lightning.addInvoice({ memo: description, valueMsat: msats, expiry })
      const newCredentials = lnc.getCredentials()
      credentials.localKeyRecv = newCredentials.localKey
      credentials.remoteKeyRecv = newCredentials.remoteKey
      credentials.serverHostRecv = newCredentials.serverHost
      if (globalThis.lncInternalContext) throw new Error('Internal context leaked')
      const paymentRequest = result.paymentRequest
      if (!paymentRequest) throw new Error('No payment request in response')
      return paymentRequest
    } finally {
      try {
        await lnc.disconnect()
      } catch (err) {
        console.error('failed to disconnect from lnc', err)
      }
    }
  })
}

async function getLNC (credentials, timeout = 21000, serverHost = 'mailbox.terminal.lightning.today:443') {
  const fs = (await import('fs')).default
  const path = (await import('path')).default
  const util = (await import('util')).default
  const perfhooks = (await import('perf_hooks')).default
  const crypto = (await import('crypto')).default
  const ws = (await import('ws')).default
  const mod = (await import('module')).default
  const { TextEncoder, TextDecoder } = util
  const { performance } = perfhooks
  const require = mod.createRequire(import.meta.url)

  function initContext (g) {
    g.lnd = { lightning: {} }
    g.credentials = credentials
    g.lncTimeout = timeout
    g.serverHost = serverHost
    g.WebSocket = ws
    g.path = path
    g.TextEncoder = TextEncoder
    g.TextDecoder = TextDecoder
    g.performance = performance
    g.crypto = crypto
    g.console = console
    g.require = require
    g.fetch = fetch
    g.setInterval = setInterval
    g.setTimeout = setTimeout
    g.clearInterval = clearInterval
    g.clearTimeout = clearTimeout
    g.LncCredentialStore = LncCredentialStore
    g.lncInternalContext = true
    return g
  }

  const code = `
const LNC = require('@lightninglabs/lnc-web');
let lncInstance;
let closing;

function clone(data) {
    return JSON.parse(JSON.stringify(data));
}

// force kill the go process
// workaround for https://github.com/lightninglabs/lnc-web/issues/83
async function kill() {
    try {
      closing = true;
      if ( !lncInstance || !lncInstance.go._inst) {
        console.log("Already killed");
        return;
      }
      console.log("Killing...");
      lncInstance.go.exited = true;
      lncInstance.go.exit(0);
    } catch (e) {
        console.error("LNC(vm): Error while killing the go runtime: ", e);
    }
}

async function disconnect() {
    closing = true;
    if (lncInstance && lncInstance.isConnected ) {
        try {
            console.log('LNC(vm): disconnecting...')
            if (lncInstance.isConnected) lncInstance.disconnect();
            await new Promise((resolve, reject) => {
                let counter = 0;
                const interval = setInterval(() => {
                    if (lncInstance.isConnected) {
                        if (counter++ > 100) {
                            console.error('LNC(vm): failed to disconnect from lnc');
                            clearInterval(interval);
                            reject(new Error('failed to disconnect from lnc'));
                        }
                        return;
                    }
                    clearInterval(interval);
                    resolve();
                }, 100);
            })
        } catch (e) {
            console.error("LNC(vm): Error while disconnecting: ", e);
        }
    }
}

async function addInvoice(args) {
    if (!lncInstance || !lncInstance.isConnected) return;
    const resp = await lncInstance.lnd.lightning.addInvoice(args);
    return resp;
}

function hasPerms(perm) {
    if (!lncInstance) throw new Error('LNC(vm): LNC not initialized');
    return lncInstance.hasPerms(perm);
}

function getCredentials() {
    if (!lncInstance) throw new Error('LNC(vm): LNC not initialized');
    return clone(lncInstance.credentials.credentials);
}

async function connect(credentials, serverHost, timeout) {
    credentials = credentials || globalThis.credentials;
    timeout = timeout || globalThis.lncTimeout;
    serverHost = serverHost || globalThis.serverHost;
    return new Promise(async (resolve, reject) => {
        try {
            const timeoutTimer = setTimeout(() => {
                kill();
                reject(new Error("Timeout"))
            }, timeout);
            lncInstance = new LNC.default({
                credentialStore: new LncCredentialStore({ ...credentials, serverHost })
            });      
            await lncInstance.connect();
            globalThis.credentials.credentials = getCredentials();
            closing = false;
            while (!closing) {
                if (lncInstance.isConnected) break;
                console.info("LNC(vm): LNC is not ready yet...waiting...");
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            clearTimeout(timeoutTimer);
            console.info("LNC(vm): LNC is connected");
            resolve();
        } catch (e) {
            console.error("LNC(vm): ", e);
            reject(e);
        }
    });
}

globalThis.lnd.lightning.addInvoice = addInvoice;
  `
  const g = initContext({})
  g.require = (module) => {
    if (module === '@lightninglabs/lnc-web') {
      const modulePath = require.resolve(module)
      const moduleCode = fs.readFileSync(modulePath, 'utf8')
      const script = new vm.Script(moduleCode, { filename: modulePath })
      const exports = {}
      const moduleContext = { exports, module: { exports }, __filename: modulePath, __dirname: path.dirname(modulePath) }
      initContext(moduleContext)
      vm.createContext(moduleContext)
      script.runInContext(moduleContext, { timeout: 15_000 })
      return moduleContext.module.exports
    }
    return require(module)
  }
  const ctx = vm.createContext(g)
  vm.runInContext(code, ctx, { timeout: 15_000 })
  if (globalThis.lncInternalContext) throw new Error('Internal context leaked')
  return ctx
}
