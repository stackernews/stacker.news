import { msatsToSats } from '@/lib/format'
import { withRandomSparkWallet } from '@/wallets/lib/protocols/spark'

export const name = 'SPARK'

export async function createInvoice ({ msats, description }, { identityPublicKey }, { signal }) {
  return await withRandomSparkWallet(
    async wallet => {
      const { invoice: { encodedInvoice: bolt11 } } = await wallet.createLightningInvoice({
        amountSats: msatsToSats(msats),
        memo: description,
        receiverIdentityPubkey: identityPublicKey
      })
      return bolt11
    }
  )
}

export async function testCreateInvoice ({ identityPublicKey }, { signal }) {
  return await createInvoice({ msats: 1000, description: 'SN test invoice' }, { identityPublicKey }, { signal })
}
