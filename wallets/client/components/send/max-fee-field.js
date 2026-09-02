import { useState } from 'react'
import { Input, InputAddon } from '@/components/form'
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@/components/ui/collapsible'
import CloseIcon from '@/svgs/close-line.svg'
import EditIcon from '@/svgs/edit-line.svg'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import classNames from 'classnames'
import { useField } from 'formik'
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
    <Collapsible open={showMaxFee} onOpenChange={setShowMaxFee} className={classNames(styles.stackSection, styles.maxFee)}>
      <div className={styles.maxFeeSummary}>
        <span className={classNames(styles.maxFeeLabel, 'text-muted font-mono')}>
          max fee
        </span>
        <CollapsibleTrigger
          className={classNames(styles.chip, styles.maxFeeControl, showMaxFee && styles.chipActive, 'font-mono')}
        >
          <span className={styles.maxFeeAmount}>{value}</span>
          <span className={classNames(styles.maxFeeUnit, 'text-muted')}>sats</span>
          <ToggleIcon className={classNames(styles.maxFeeIcon, 'text-muted')} width={18} height={18} aria-hidden />
        </CollapsibleTrigger>
      </div>
      <CollapsiblePanel>
        <Input
          label='max fee'
          name='maxFee'
          type='number'
          step={10}
          required
          append={<InputAddon className='font-mono'>sats</InputAddon>}
        />
      </CollapsiblePanel>
    </Collapsible>
  )
}
