import { useState } from 'react'
import { Input } from '@/components/form'
import CloseIcon from '@/svgs/close-line.svg'
import EditIcon from '@/svgs/edit-line.svg'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import classNames from 'classnames'
import { useField } from 'formik'
import { InputGroup } from 'react-bootstrap'
import { DestinationType } from './destination'
const styles = { ...sharedStyles, ...sendStyles }

export function FeeControl ({ enforcesMaxFee, destination, lnAddrPendingOrReady }) {
  const applies = destination.type === DestinationType.BOLT11 || lnAddrPendingOrReady
  if (!applies) return null
  if (enforcesMaxFee) return <MaxFeeField />
  return (
    <div className='text-muted small mt-2'>
      This wallet does not support a per-payment max fee.
    </div>
  )
}

function MaxFeeField () {
  const [showMaxFee, setShowMaxFee] = useState(false)
  const [{ value }] = useField('maxFee')
  const ToggleIcon = showMaxFee ? CloseIcon : EditIcon

  return (
    <div className={classNames(styles.stackSection, styles.maxFee)}>
      <div className={styles.maxFeeSummary}>
        <span className={classNames(styles.maxFeeLabel, 'text-muted font-monospace')}>
          max fee
        </span>
        <button
          type='button'
          className={classNames(styles.chip, styles.maxFeeControl, showMaxFee && styles.chipActive, 'font-monospace')}
          onClick={() => setShowMaxFee(show => !show)}
          aria-expanded={showMaxFee}
        >
          <span className={styles.maxFeeAmount}>{value}</span>
          <span className={classNames(styles.maxFeeUnit, 'text-muted')}>sats</span>
          <ToggleIcon className={classNames(styles.maxFeeIcon, 'text-muted')} width={18} height={18} aria-hidden />
        </button>
      </div>
      {showMaxFee && (
        <Input
          label='max fee'
          name='maxFee'
          type='number'
          step={10}
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
      )}
    </div>
  )
}
