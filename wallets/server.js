import * as lnd from 'wallets/lnd/server'
import * as cln from 'wallets/cln/server'
import * as lnAddr from 'wallets/lightning-address/server'

// worker and app import modules differently
// const resolveImport = i => i.default || i

export default [lnd, cln, lnAddr]
