import * as nwc from '@/wallets/nwc/client'
import * as lnbits from '@/wallets/lnbits/client'
import * as lnc from '@/wallets/lnc/client'
import * as lnAddr from '@/wallets/lightning-address/client'
import * as cln from '@/wallets/cln/client'
import * as lnd from '@/wallets/lnd/client'
import * as webln from '@/wallets/webln/client'
import * as blink from '@/wallets/blink/client'
import * as phoenixd from '@/wallets/phoenixd/client'

// TODO(wallet-v2): will we still need this?
//
// We're storing wallet templates on the server in a static table now. So I think we can load the list of available wallets
// via GraphQL and populate any additional information the client needs in resolvers instead of using imports like this.
export default [nwc, lnbits, lnc, lnAddr, cln, lnd, webln, blink, phoenixd]
