import { externalLightningAddressValidator, parseNwcUrl } from '@/wallets/lib/validate'
import { protocolFormId, walletLud16Domain } from '../util'

// Lightning Address (LUD-16)
// https://github.com/lnurl/luds/blob/luds/16.md

export default {
  name: 'LN_ADDR',
  displayName: 'Lightning Address',
  send: false,
  fields: [
    {
      name: 'address',
      label: 'address',
      type: 'text',
      required: true,
      validate: externalLightningAddressValidator,
      populate: addressPopulate
    }
  ],
  relationName: 'walletRecvLightningAddress'
}

function addressPopulate (wallet, formState) {
  const nwcFormId = protocolFormId({ name: 'NWC', send: true })
  const nwcFormState = formState[nwcFormId]
  if (!nwcFormState?.config?.url) {
    return null
  }

  const { lud16: nwcLud16 } = parseNwcUrl(nwcFormState.config.url)
  if (!nwcLud16) {
    return null
  }

  const lud16Domain = walletLud16Domain(wallet.name)
  const nwcLud16Domain = nwcLud16.split('@')[1]
  if (lud16Domain && nwcLud16Domain !== lud16Domain) {
    return null
  }

  return nwcLud16
}
