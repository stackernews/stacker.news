import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { authenticatedLndGrpc } from '@/lib/lnd'

const STACKER_LND_SOCKET = 'lnd:10009'
const STACKER_LND_CERT_PATHS = [join(process.cwd(), 'docker/lnd/stacker/tls.cert')]
const STACKER_LND_MACAROON_PATHS = [
  join(process.cwd(), 'docker/lnd/stacker/regtest/admin.macaroon'),
  join(process.cwd(), 'docker/lnd/stacker/admin.macaroon')
]

function readFirstExistingHex (paths, label) {
  const path = paths.find(p => existsSync(p))
  if (!path) throw new Error(`could not find stacker LND ${label}`)
  return readFileSync(path).toString('hex')
}

// dev-only: stacker lnd proxy used by the Spark mock to mint and pay
// local invoices on behalf of Spark wallets that have no sndev routing.
export function stackerLnd () {
  if (!globalThis.__sparkMockStackerLnd) {
    globalThis.__sparkMockStackerLnd = authenticatedLndGrpc({
      cert: readFirstExistingHex(STACKER_LND_CERT_PATHS, 'tls.cert'),
      macaroon: readFirstExistingHex(STACKER_LND_MACAROON_PATHS, 'admin.macaroon'),
      socket: STACKER_LND_SOCKET
    }).lnd
  }
  return globalThis.__sparkMockStackerLnd
}
