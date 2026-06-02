import classNames from 'classnames'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import testUiStyles from './capability-test-ui.module.css'
import { CopyButton } from '@/components/form'
import AccordianItem from '@/components/accordian-item'
import { isTemplate, protocolFields, protocolKey, protocolLogName } from '@/wallets/lib/util'
import { useFormikContext } from 'formik'
import { useProtocolStatus } from './hooks/context'
import { hasEmptyRequiredField } from './test-status'
import { TestStatus } from './hooks/tests'
import ClipboardIcon from '@/svgs/clipboard-line.svg'
const styles = { ...sharedStyles, ...testUiStyles }

export function CapabilityTestRow ({ protocol, onTest }) {
  const cap = useProtocolStatus(protocol)
  if (cap?.enabled === false) return null

  return (
    <div className={classNames(styles.testRow, 'd-flex align-items-center justify-content-between gap-2 mt-1')}>
      <span className='text-truncate'>
        {protocol.send
          ? 'Test that this wallet can send payments.'
          : 'Test that this wallet can create invoices.'}
      </span>
      <CapabilityTestButton protocol={protocol} onTest={onTest} />
    </div>
  )
}

export function CapabilityStateRow ({ protocol, onRemove, onCancel }) {
  const formik = useFormikContext()
  const key = protocolKey(protocol)
  const enabled = useProtocolStatus(protocol)?.enabled !== false
  // Fieldless protocols (WebLN) use add/remove rather than an enable/disable
  // toggle, so the toggle is only for configured (field-based) saved protocols.
  const showToggle = !isTemplate(protocol) && protocolFields(protocol).length > 0

  if (!showToggle && !onRemove && !onCancel) return null

  return (
    <div className='d-flex align-items-center justify-content-between gap-3 mt-1'>
      {onRemove && (
        <button
          type='button'
          className={classNames(styles.textButton, styles.dangerTextButton, 'align-self-center lh-1')}
          onClick={onRemove}
        >
          remove {protocol.send ? 'send' : 'receive'}
        </button>
      )}
      {onCancel && (
        <button
          type='button'
          className={classNames(styles.textButton, 'align-self-center lh-1')}
          onClick={onCancel}
        >
          cancel {protocol.send ? 'send' : 'receive'}
        </button>
      )}
      {showToggle && (
        <label className={styles.toggle}>
          <input
            type='checkbox'
            role='switch'
            checked={enabled}
            onChange={(e) => formik.setFieldValue(`${key}.enabled`, e.target.checked)}
          />
          <span className={styles.toggleTrack} aria-hidden='true' />
          <span className={styles.toggleLabel}>{enabled ? 'enabled' : 'disabled'}</span>
        </label>
      )}
    </div>
  )
}

export function CapabilityError ({ message, details }) {
  return (
    <div className={styles.error}>
      <CopyButton
        value={details || message}
        className={classNames(styles.textButton, styles.errorCopy)}
        append={<ClipboardIcon width={16} height={16} />}
        title='copy error details'
        aria-label='copy error details'
      />
      <div className='text-danger fw-bold line-height-sm'>{message}</div>
      {details && (
        <AccordianItem
          header='details'
          body={<pre className={styles.errorDetails}>{details}</pre>}
        />
      )}
    </div>
  )
}

function CapabilityTestButton ({ protocol, onTest }) {
  const { isSubmitting } = useFormikContext()
  const cap = useProtocolStatus(protocol)
  const testing = cap?.status === TestStatus.TESTING
  const action = cap?.canSave ? 'test again' : 'test'
  // Disable while required fields are empty so the user can't run a test that
  // would either misleadingly noop or silently dispatch a validation failure.
  const missingRequired = hasEmptyRequiredField(protocolFields(protocol), cap?.config)

  return (
    <button
      type='button'
      className={classNames(styles.textButton, styles.infoTextButton, styles.testButton)}
      disabled={testing || isSubmitting || missingRequired}
      title={missingRequired ? 'fill required fields before testing' : undefined}
      onClick={onTest}
    >
      {testing ? `testing ${protocolLogName(protocol)}...` : action}
    </button>
  )
}
