import classNames from 'classnames'
import styles from './test-status.module.css'
import CheckCircle from '@/svgs/checkbox-circle-fill.svg'
import { protocolDisplayName } from '@/wallets/lib/util'
import { TestStatus } from './hooks/tests'

const TEST_STATUS_PRESENTATION = {
  [TestStatus.SAVED]: { label: 'saved', className: styles.tested, icon: true },
  [TestStatus.TESTED]: { label: 'tested', className: styles.tested, icon: true },
  [TestStatus.TESTING]: { label: 'testing', className: styles.testing },
  [TestStatus.NEEDS_TEST]: { label: 'needs test', className: styles.testing },
  [TestStatus.FAILED]: { label: 'failed', className: styles.failed },
  [TestStatus.NOT_SET]: { label: 'not set' },
  [TestStatus.DISABLED]: { label: 'disabled' }
}

export function CapabilityStatus ({ status }) {
  const presentation = TEST_STATUS_PRESENTATION[status] ?? TEST_STATUS_PRESENTATION[TestStatus.NOT_SET]
  return (
    <span className={classNames(styles.status, 'd-inline-flex align-items-center gap-1 flex-shrink-0 fw-bold line-height-1', presentation.className)}>
      {presentation.icon && <CheckCircle width={14} height={14} />}
      {presentation.label}
    </span>
  )
}

export function testErrorDetails (err, protocol) {
  const side = protocol.send ? 'send' : 'receive'
  const message = err?.graphQLErrors?.[0]?.message || err?.message || 'test failed'
  const detailLines = [
    err?.networkError && `Network error: ${err.networkError.message}`,
    err?.cause && `Cause: ${err.cause.message || err.cause.toString?.()}`
  ].filter(Boolean)

  return {
    message: `${protocolDisplayName(protocol)} ${side} failed: ${message}`,
    details: detailLines.join('\n\n')
  }
}

export function firstValidationError (errors) {
  if (!errors) return null
  if (typeof errors === 'string') return errors
  if (Array.isArray(errors)) return errors.map(firstValidationError).find(Boolean)
  return Object.values(errors).map(firstValidationError).find(Boolean)
}

export function hasEmptyRequiredField (fields, values) {
  return fields.some(field => field.required && isEmptyValue(values?.[field.name]))
}

function isEmptyValue (value) {
  return value === '' || value === undefined || value === null
}
