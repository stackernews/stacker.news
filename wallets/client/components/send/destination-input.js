import { Input } from '@/components/form'
import { MiddleEllipsis } from '@/components/copy-chip'
import { bolt11Description } from '@/lib/bolt11'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import layoutStyles from '@/wallets/client/components/layout.module.css'
import { useField } from 'formik'
import classNames from 'classnames'
import { DestinationType, lnAddrStatus, parseDestination } from './destination'
import { DestinationActions } from './destination-actions'
const styles = { ...sharedStyles, ...sendStyles }

// One label per lookup status; missing keys (idle, stale) reserve a blank line.
const LN_ADDR_STATUS_TEXT = {
  loading: 'checking lightning address...',
  server: 'lightning address will be checked when you send',
  ready: '✓ lightning address'
}

function lnAddrStatusText (destination, lnAddrLookup) {
  const status = lnAddrStatus(destination, lnAddrLookup)
  if (status === 'error') return lnAddrLookup.error
  return LN_ADDR_STATUS_TEXT[status] ?? ' '
}

export function DestinationInput ({ destination, lnAddrLookup, onDestinationChange, checkDestination }) {
  const [, meta, helpers] = useField('destination')
  const textInput = (
    <DestinationTextInput
      onDestinationChange={onDestinationChange}
      checkDestination={checkDestination}
      destination={destination}
      lnAddrLookup={lnAddrLookup}
    />
  )

  if (destination.type === DestinationType.BOLT11) {
    if (destination.invoiceMsats == null) return textInput

    return (
      <DetectedDestinationRow
        value={destination.value}
        error={meta.touched && meta.error}
        onReplace={() => {
          helpers.setValue('')
          checkDestination('')
        }}
      />
    )
  }

  return textInput
}

function DestinationTextInput ({ onDestinationChange, checkDestination, destination, lnAddrLookup }) {
  return (
    <Input
      label='invoice or lightning address'
      name='destination'
      as='textarea'
      rows={3}
      required
      autoFocus
      className={layoutStyles.walletDestinationInput}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        const { value, type } = parseDestination(e.currentTarget.value)
        if (type !== DestinationType.LN_ADDR) return
        e.preventDefault()
        checkDestination(value)
        e.currentTarget.blur()
      }}
      onChange={onDestinationChange}
      under={
        <>
          <DestinationActions onValue={checkDestination} />
          <div className={classNames(styles.lnAddrPending, 'text-muted small line-height-sm')} aria-live='polite'>
            {lnAddrStatusText(destination, lnAddrLookup)}
          </div>
        </>
      }
    />
  )
}

function DetectedDestinationRow ({ value, error, onReplace }) {
  const description = bolt11Description(value)
  return (
    <>
      <div className={classNames(styles.surfaceRow, styles.detectedRow, error && 'is-invalid')}>
        <div className={styles.detectedIdentity}>
          <div className={classNames(styles.detectedValue, 'font-monospace')} title={value}>
            <MiddleEllipsis value={description || value} />
          </div>
          <div className={classNames(styles.walletRowMeta, 'd-flex flex-wrap align-items-center text-muted')}>
            <span>bolt11 invoice</span>
          </div>
        </div>
        <button type='button' className={styles.textButton} onClick={onReplace}>
          replace
        </button>
      </div>
      {error && <div className='invalid-feedback d-block'>{error}</div>}
    </>
  )
}
