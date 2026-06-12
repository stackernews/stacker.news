import { useCallback, useState } from 'react'
import classNames from 'classnames'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import cardStyles from './capability-card.module.css'
import { protocolDisplayName, protocolFields, protocolKey } from '@/wallets/lib/util'
import { useFormikContext } from 'formik'
import { useProtocolStatus } from './hooks/context'
import { CapabilityStatus } from './test-status'
import { CapabilityError, CapabilityStateRow, CapabilityTestRow } from './capability-test-ui'
import { WalletProtocolFormField } from './protocol-fields'
import { emptyDraft, isSavedProtocol } from './hooks/draft'
import { useCapabilityTest } from './hooks/use-capability-test'
const styles = { ...sharedStyles, ...cardStyles }

// `selection` ({ protocol, choose }) is omitted by single-protocol fallback
// cards, which default to their only protocol.
export function CapabilityCard ({ title, subtitle, icon, tone, protocols, selection, onNwcLud16, optional = false }) {
  const formik = useFormikContext()
  const [showProtocolChoices, setShowProtocolChoices] = useState(false)
  const protocol = selection?.protocol ?? protocols[0]
  const key = protocolKey(protocol)
  const cap = useProtocolStatus(protocol)
  const status = cap?.status
  const hasConfiguredValues = cap?.meaningful ?? false
  // A configured card is always open; `opened` only tracks the user explicitly
  // expanding an empty one. Deriving `open` avoids re-opening via an effect.
  const [opened, setOpened] = useState(false)
  const open = opened || hasConfiguredValues

  // Reset a discarded draft back to empty so its status becomes NOT_SET. A saved
  // protocol keeps its config (backing out must not lose it); switching away
  // additionally disables it (disableSaved) so it isn't re-upserted as a hidden
  // enabled duplicate, and re-selecting it re-enables it.
  const deactivateDrafts = useCallback((candidates, { disableSaved = false } = {}) => {
    for (const candidate of candidates) {
      if (isSavedProtocol(candidate)) {
        if (disableSaved) formik.setFieldValue(`${protocolKey(candidate)}.enabled`, false)
        continue
      }
      formik.setFieldValue(protocolKey(candidate), emptyDraft(candidate))
    }
  }, [formik])

  if (!protocol) return null

  const onRemove = () => {
    if (!hasConfiguredValues) return
    // Removal is just an emptied draft: a persisted protocol whose draft has no
    // meaningful config is deleted on save (willRemove).
    formik.setFieldValue(key, emptyDraft(protocol))
    setOpened(false)
  }

  const onCancel = () => {
    deactivateDrafts(protocols)
    setShowProtocolChoices(false)
    setOpened(false)
  }

  return (
    <section
      className={classNames(
        styles.card,
        tone === 'send' && styles.cardSend,
        tone === 'receive' && styles.cardReceive,
        tone === 'fallback' && styles.cardFallback,
        optional && styles.cardOptional
      )}
    >
      <div className={classNames(styles.header, 'd-flex align-items-start justify-content-between gap-3 flex-nowrap')}>
        <div className={styles.titleBlock}>
          <div className={classNames(styles.titleRow, 'd-flex align-items-center')}>
            {icon && <span className={classNames(styles.icon, 'd-inline-flex align-items-center justify-content-center flex-shrink-0')}>{icon}</span>}
            <h2>{title}</h2>
          </div>
          <div className={classNames(styles.subtitle, 'text-truncate text-muted')}>
            {subtitle}
            {protocols.length > 1 && ` via ${protocolDisplayName(protocol)}`}
          </div>
        </div>
        <CapabilityStatus status={status} />
      </div>

      {open
        ? (
          <>
            {protocols.length > 1 && (
              <CapabilityMethodPicker
                protocol={protocol}
                protocols={protocols}
                showChoices={showProtocolChoices}
                setShowChoices={setShowProtocolChoices}
                onSelect={(option) => {
                  // Switching away disables saved protocols so they aren't re-upserted as
                  // hidden enabled duplicates; re-enable the chosen connection in case it
                  // was a previously-disabled saved protocol being re-selected.
                  deactivateDrafts(protocols.filter(p => protocolKey(p) !== protocolKey(option)), { disableSaved: true })
                  formik.setFieldValue(`${protocolKey(option)}.enabled`, true)
                  selection.choose(option.name)
                  setShowProtocolChoices(false)
                  // Switching to a not-yet-configured connection drops hasConfiguredValues,
                  // which would collapse the card; pin it open since this is an active edit.
                  setOpened(true)
                }}
              />
            )}
            <CapabilityProtocolFields
              protocol={protocol}
              onNwcLud16={onNwcLud16}
              onRemove={hasConfiguredValues ? onRemove : null}
              onCancel={!hasConfiguredValues ? onCancel : null}
            />
          </>
          )
        : (
          <button
            type='button'
            className={classNames(styles.textButton, styles.infoTextButton, 'align-self-start')}
            onClick={() => {
              // A fieldless protocol (WebLN) has nothing to configure, so adding it
              // just enables it; "remove send" disables it again.
              if (protocolFields(protocol).length === 0) formik.setFieldValue(`${key}.enabled`, true)
              setOpened(true)
            }}
          >
            + add
          </button>
          )}
    </section>
  )
}

function CapabilityMethodPicker ({ protocol, protocols, showChoices, setShowChoices, onSelect }) {
  return (
    <div className={styles.method}>
      <strong>{protocolDisplayName(protocol)}</strong>
      <button
        type='button'
        className={classNames(styles.textButton, styles.methodButton)}
        onClick={() => setShowChoices(show => !show)}
      >
        {showChoices ? 'hide options' : 'change connection'}
      </button>
      {showChoices && (
        <div className={classNames(styles.protocolSelector, 'd-flex flex-wrap gap-2')}>
          {protocols.map(option => (
            <button
              key={protocolKey(option)}
              type='button'
              className={classNames(
                styles.chip,
                option.name === protocol.name && styles.chipActive
              )}
              onClick={() => onSelect(option)}
            >
              {protocolDisplayName(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CapabilityProtocolFields ({ protocol, onNwcLud16, onRemove, onCancel }) {
  const fields = protocolFields(protocol)
  const { error, details, onTest } = useCapabilityTest(protocol)

  return (
    <div className={classNames(styles.form, styles.formResponsiveReset, 'd-flex flex-column gap-3')}>
      {fields.length === 0 && (
        <p className='text-muted mb-0'>
          No configuration needed for {protocolDisplayName(protocol)}.
        </p>
      )}
      {fields.map(field => <WalletProtocolFormField key={field.name} protocol={protocol} onNwcLud16={onNwcLud16} {...field} />)}

      {error && <CapabilityError message={error} details={details} protocol={protocol} />}

      <CapabilityTestRow protocol={protocol} onTest={onTest} />
      <CapabilityStateRow protocol={protocol} onRemove={onRemove} onCancel={onCancel} />
    </div>
  )
}
