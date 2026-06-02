import { useFormikContext } from 'formik'
import { SubmitButton } from '@/components/form'
import { formatSats, msatsToSats, toPositiveNumber } from '@/lib/format'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import { WalletBottomBar } from '@/wallets/client/components/bottom-bar'
import { DestinationType } from './destination'
const styles = { ...sharedStyles, ...sendStyles }

export function SendFooter ({ destination, lnAddrLookup }) {
  const { values } = useFormikContext()

  return (
    <WalletBottomBar className={styles.footer}>
      <SubmitButton
        variant='primary'
        className={styles.submit}
        appendText={sendAmountText(values.amount, destination)}
        disabled={lnAddrLookup.loading}
      >
        send
      </SubmitButton>
    </WalletBottomBar>
  )
}

function sendAmountText (amount, destination) {
  if (destination.type === DestinationType.LN_ADDR) return satsAmountText(amount)
  if (destination.type === DestinationType.BOLT11) {
    return destination.invoiceMsats == null ? undefined : formatSats(msatsToSats(destination.invoiceMsats))
  }
}

function satsAmountText (value) {
  try {
    const sats = toPositiveNumber(value)
    if (sats <= 0) return undefined
    return formatSats(sats)
  } catch {
    return undefined
  }
}
