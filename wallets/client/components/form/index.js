import { useCallback, useEffect, useMemo, useState } from 'react'
import { InputGroup } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import { Form, Input, PasswordInput } from '@/components/form'
import Text from '@/components/text'
import Info from '@/components/info'
import { isTemplate, protocolDisplayName, protocolFormId, protocolLogName, walletDisplayName, walletLud16Domain } from '@/wallets/lib/util'
import { WalletGuide, WalletLayoutImageOrName } from '../layout'
import { WalletDeleteObstacle } from '@/wallets/client/components/card'
import { useTestSendPayment, useTestCreateInvoice, useWalletSupport, useSingleFlight, useWalletImage } from '@/wallets/client/hooks'
import ArrowUpRight from '@/svgs/arrow-right-up-line.svg'
import ArrowDownLeft from '@/svgs/arrow-left-down-line.svg'
import CheckCircle from '@/svgs/checkbox-circle-fill.svg'
import TrashIcon from '@/svgs/delete-bin-line.svg'
import { useFormikContext } from 'formik'
import { WalletSettingsFormContextProvider, useWallet, useWalletFormState, useWalletProtocols, useProtocolForm, useSaveWallet, useClearWalletProtocolForm, hasProtocolConfig } from './hooks'
import { useToast } from '@/components/toast'
import { useShowModal } from '@/components/modal'
import { useRouter } from 'next/router'
import copy from 'clipboard-copy'
import { parseNwcUrl } from '@/wallets/lib/validate'

const TestStatus = {
  SAVED: 'saved',
  TESTED: 'tested',
  NEEDS_TEST: 'needs_test',
  TESTING: 'testing',
  FAILED: 'failed',
  NOT_SET: 'not_set'
}

export function WalletMultiStepForm ({ wallet }) {
  const initial = useMemo(() => wallet.protocols
    .filter(p => !isTemplate(p))
    .reduce((acc, p) => {
      const formId = protocolFormId(p)
      return {
        ...acc,
        [formId]: p
      }
    }, {}), [wallet])

  return (
    <WalletSettingsFormContextProvider wallet={wallet} initial={initial}>
      <WalletSettingsForm />
    </WalletSettingsFormContextProvider>
  )
}

function WalletSettingsForm () {
  const wallet = useWallet()
  const support = useWalletSupport(wallet)
  const sendProtocols = useWalletProtocols(true)
  const receiveProtocols = useWalletProtocols(false)
  const primarySendProtocols = useMemo(() => sendProtocols.filter(p => p.name !== 'WEBLN'), [sendProtocols])
  const fallbackSendProtocols = useMemo(() => sendProtocols.filter(p => p.name === 'WEBLN'), [sendProtocols])
  const sharedMethodNames = useMemo(() => {
    const receiveNames = new Set(receiveProtocols.map(protocol => protocol.name))
    return primarySendProtocols.map(protocol => protocol.name).filter(name => receiveNames.has(name))
  }, [primarySendProtocols, receiveProtocols])
  const [connectionMethod, setConnectionMethod] = useState(sharedMethodNames[0])
  const [preferredReceiveProtocolName, setPreferredReceiveProtocolName] = useState()
  const [formState, setFormState] = useWalletFormState()
  const [testState, setTestState] = useState({})
  const saveWallet = useSaveWallet()
  const toaster = useToast()
  const router = useRouter()

  const configuredProtocols = useMemo(() => {
    return Object.values(formState).filter(protocol => {
      return protocol?.enabled !== false && hasProtocolConfig(protocol)
    })
  }, [formState])
  const hasConfiguredCapability = useMemo(() => {
    return Object.values(formState).some(hasProtocolConfig)
  }, [formState])
  const hasPendingRemoval = useMemo(() => {
    return !isTemplate(wallet) && wallet.protocols.some(protocol => !hasProtocolConfig(formState[protocolFormId(protocol)]))
  }, [wallet, formState])

  const saveBlocker = useMemo(() => {
    const dirtyTest = Object.values(testState).find(({ status }) => {
      return [TestStatus.NEEDS_TEST, TestStatus.TESTING, TestStatus.FAILED].includes(status)
    })
    if (dirtyTest) return statusBlockerMessage(dirtyTest)

    if (!hasConfiguredCapability && !hasPendingRemoval) {
      return 'configure at least one capability'
    }

    const unready = configuredProtocols.find(protocol => !isProtocolReadyToSave(protocol, testState))
    if (unready) return `test ${unready.send ? 'send' : 'receive'} before saving`

    return null
  }, [configuredProtocols, hasConfiguredCapability, hasPendingRemoval, testState])

  const canSave = !saveBlocker

  const onSaveWalletSubmit = useCallback(async () => {
    if (!canSave) return
    try {
      await saveWallet()
      toaster.success('wallet saved')
      router.push(wallet.id ? `/wallets/${wallet.id}` : '/wallets')
    } catch (err) {
      console.error(err)
      toaster.danger('failed to save wallet')
    }
  }, [canSave, saveWallet, toaster, router])

  const [onSave, inFlight] = useSingleFlight(onSaveWalletSubmit)

  useEffect(() => {
    if (!sharedMethodNames.includes(connectionMethod)) {
      setConnectionMethod(sharedMethodNames[0])
    }
  }, [connectionMethod, sharedMethodNames])

  const onSharedMethodChange = useCallback((name) => {
    if (sharedMethodNames.includes(name)) {
      setConnectionMethod(name)
    }
  }, [sharedMethodNames])

  const onReceiveMethodChange = useCallback((name) => {
    setPreferredReceiveProtocolName(name)
    onSharedMethodChange(name)
  }, [onSharedMethodChange])

  const onNwcLud16 = useCallback((address) => {
    const protocol = receiveProtocols.find(protocol => protocol.name === 'LN_ADDR')
    if (!protocol || !address) return

    setPreferredReceiveProtocolName('LN_ADDR')
    const testValues = normalizeTestValues(protocol, { enabled: true, address })
    setFormState(protocolFormId(protocol), {
      name: protocol.name,
      send: protocol.send,
      __typename: 'WalletProtocol',
      enabled: true,
      config: { address }
    })
    setTestState(prev => ({
      ...prev,
      [protocolFormId(protocol)]: {
        status: TestStatus.NEEDS_TEST,
        error: null,
        fingerprint: valuesFingerprint(testValues),
        protocol
      }
    }))
  }, [receiveProtocols, setFormState])

  return (
    <div className={styles.walletSettingsPage}>
      <main className={styles.walletSettingsMain}>
        <WalletSettingsHeader />

        <div className={styles.capabilityList}>
          {support.send && primarySendProtocols.length > 0 && (
            <CapabilityCard
              title='send capability'
              subtitle='wallet payments'
              icon={<ArrowUpRight width={16} height={16} />}
              tone='send'
              protocols={primarySendProtocols}
              preferredProtocolName={connectionMethod}
              onMethodChange={onSharedMethodChange}
              onNwcLud16={onNwcLud16}
              testState={testState}
              setTestState={setTestState}
            />
          )}

          {support.receive && receiveProtocols.length > 0 && (
            <CapabilityCard
              title='receive capability'
              subtitle='invoice creation'
              icon={<ArrowDownLeft width={16} height={16} />}
              tone='receive'
              protocols={receiveProtocols}
              preferredProtocolName={preferredReceiveProtocolName ?? connectionMethod}
              forcePreferredProtocol={!!preferredReceiveProtocolName}
              onMethodChange={onReceiveMethodChange}
              testState={testState}
              setTestState={setTestState}
            />
          )}

          {fallbackSendProtocols.map(protocol => (
            <CapabilityCard
              key={protocolFormId(protocol)}
              title='WebLN fallback'
              subtitle='optional browser support'
              protocols={[protocol]}
              tone='fallback'
              optional
              testState={testState}
              setTestState={setTestState}
            />
          ))}
        </div>
        {!isTemplate(wallet) && <WalletSettingsDangerZone wallet={wallet} />}
      </main>

      <aside className={styles.walletSettingsAside}>
        <div className={styles.walletSettingsAsideCard}>
          <WalletLayoutImageOrName name={wallet.name} maxHeight='48px' />
          <div className={styles.walletSettingsAsideTitle}>{walletDisplayName(wallet.name)}</div>
          <p className='text-muted mb-0'>
            Set up this wallet's capabilities, then test them before saving.
          </p>
          <WalletGuide name={wallet.name} />
        </div>
        <div className={styles.walletSettingsAsideCard}>
          <div className={styles.walletSettingsAsideTitle}>save status</div>
          <p className='text-muted mb-0'>
            {canSave ? 'ready to save' : saveBlocker}
          </p>
        </div>
      </aside>

      <div className={styles.walletSettingsSaveBar}>
        <button type='button' className={styles.walletFooterBackButton} onClick={() => router.back()}>
          back
        </button>
        {!canSave
          ? <div className={styles.walletSettingsSaveBlocker}>{saveBlocker}</div>
          : (
            <button
              type='button'
              className={classNames('btn btn-primary', styles.walletSettingsSaveButton, inFlight && 'pulse')}
              disabled={inFlight}
              onClick={onSave}
            >
              {inFlight ? 'saving wallet...' : 'save wallet'}
            </button>
            )}
      </div>
    </div>
  )
}

function WalletSettingsDangerZone ({ wallet }) {
  const showModal = useShowModal()
  const router = useRouter()

  return (
    <section className={styles.walletSettingsDangerZone}>
      <div>
        <h2>danger zone</h2>
        <p>Delete this wallet and its saved send/receive configuration.</p>
      </div>
      <button
        type='button'
        className={styles.deleteWalletButton}
        onClick={() => showModal(onClose => (
          <WalletDeleteObstacle wallet={wallet} onClose={onClose} onSuccess={() => router.push('/wallets')} />
        ))}
      >
        <TrashIcon width={16} height={16} /> delete wallet
      </button>
    </section>
  )
}

function WalletSettingsHeader () {
  const wallet = useWallet()
  const image = useWalletImage(wallet.name)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [image?.src])

  return (
    <header className={styles.walletSettingsHeader}>
      <h1>configure</h1>
      <div className={styles.walletActionWallet}>
        {image && !imageError
          ? <img src={image.src} alt={image.alt} onError={() => setImageError(true)} className={styles.walletActionWalletLogo} />
          : walletDisplayName(wallet.name)}
      </div>
    </header>
  )
}

function CapabilityCard ({ title, subtitle, icon, tone, protocols, preferredProtocolName, forcePreferredProtocol, onMethodChange, onNwcLud16, optional = false, testState, setTestState }) {
  const [formState] = useWalletFormState()
  const clearProtocolForm = useClearWalletProtocolForm()
  const [showProtocolChoices, setShowProtocolChoices] = useState(false)
  const initialProtocol = useMemo(() => {
    return protocols.find(protocol => hasProtocolConfig(formState[protocolFormId(protocol)])) ??
      protocols.find(protocol => protocol.name === preferredProtocolName) ??
      protocols[0]
  }, [protocols, formState, preferredProtocolName])
  const [selectedProtocolName, setSelectedProtocolName] = useState(initialProtocol?.name)
  const [hasSelectedProtocol, setHasSelectedProtocol] = useState(false)

  useEffect(() => {
    if (!protocols.find(protocol => protocol.name === selectedProtocolName)) {
      setSelectedProtocolName(initialProtocol?.name)
      setHasSelectedProtocol(false)
    }
  }, [protocols, selectedProtocolName, initialProtocol])

  const protocol = protocols.find(protocol => protocol.name === selectedProtocolName) ?? initialProtocol
  const formId = protocolFormId(protocol)
  const protocolState = formState[formId]
  const configured = hasProtocolConfig(protocolState)
  const status = getCapabilityStatus(protocolState, testState[formId])
  const [open, setOpen] = useState(configured)

  useEffect(() => {
    if (selectedProtocolName === preferredProtocolName) return
    if ((forcePreferredProtocol || (!configured && !hasSelectedProtocol)) && protocols.find(protocol => protocol.name === preferredProtocolName)) {
      setSelectedProtocolName(preferredProtocolName)
    }
  }, [configured, forcePreferredProtocol, hasSelectedProtocol, preferredProtocolName, protocols, selectedProtocolName])

  useEffect(() => {
    if (configured) setOpen(true)
  }, [configured])

  if (!protocol) return null

  const onRemove = async () => {
    if (!configured) return
    if (!window.confirm(`Remove ${protocol.send ? 'send' : 'receive'} from this wallet? This change is saved when you save the wallet.`)) return

    clearProtocolForm(formId)
    setTestState(({ [formId]: _removed, ...testState }) => testState)
    setOpen(false)
  }

  const clearTransientProtocol = (id) => {
    clearProtocolForm(id)
    setTestState(({ [id]: _removed, ...testState }) => testState)
  }

  const onCancel = () => {
    protocols.forEach(protocol => clearProtocolForm(protocolFormId(protocol)))
    setTestState(testState => {
      const protocolIds = new Set(protocols.map(protocol => protocolFormId(protocol)))
      return Object.fromEntries(Object.entries(testState).filter(([id]) => !protocolIds.has(id)))
    })
    setShowProtocolChoices(false)
    setOpen(false)
  }

  return (
    <section
      className={classNames(
        styles.capabilityCard,
        tone === 'send' && styles.sendCapabilityCard,
        tone === 'receive' && styles.receiveCapabilityCard,
        tone === 'fallback' && styles.fallbackCapabilityCard,
        optional && styles.optionalCapabilityCard
      )}
    >
      <div className={styles.capabilityHeader}>
        <div className={styles.capabilityTitleBlock}>
          <div className={styles.capabilityTitleRow}>
            {icon && <span className={styles.capabilityIcon}>{icon}</span>}
            <h2>{title}</h2>
          </div>
          <div className={styles.capabilitySubtitle}>
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
                  if (!configured) clearTransientProtocol(formId)
                  setSelectedProtocolName(option.name)
                  setHasSelectedProtocol(true)
                  onMethodChange?.(option.name)
                  setShowProtocolChoices(false)
                }}
              />
            )}
            <CapabilityProtocolForm
              key={formId}
              protocol={protocol}
              testState={testState}
              setTestState={setTestState}
              onNwcLud16={onNwcLud16}
              onRemove={configured ? onRemove : null}
              onCancel={!configured ? onCancel : null}
            />
          </>
          )
        : (
          <button
            type='button'
            className={styles.capabilityAddButton}
            onClick={() => setOpen(true)}
          >
            + add
          </button>
          )}
    </section>
  )
}

function CapabilityMethodPicker ({ protocol, protocols, showChoices, setShowChoices, onSelect }) {
  return (
    <div className={styles.capabilityMethod}>
      <strong>{protocolDisplayName(protocol)}</strong>
      <button
        type='button'
        className={styles.capabilityTextButton}
        onClick={() => setShowChoices(show => !show)}
      >
        {showChoices ? 'hide options' : 'change connection'}
      </button>
      {showChoices && (
        <div className={styles.capabilityProtocolSelector}>
          {protocols.map(option => (
            <button
              key={protocolFormId(option)}
              type='button'
              className={classNames(
                styles.capabilityProtocolButton,
                option.name === protocol.name && styles.activeCapabilityProtocolButton
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

function CapabilityProtocolForm ({ protocol, testState, setTestState, onNwcLud16, onRemove, onCancel }) {
  const wallet = useWallet()
  const testSendPayment = useTestSendPayment(protocol)
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const [{ fields, initial, schema }, setFormState] = useProtocolForm(protocol)
  const formId = protocolFormId(protocol)
  const status = testState[formId]?.status
  const error = testState[formId]?.error
  const details = testState[formId]?.details
  const action = status === TestStatus.TESTED ? 'test again' : 'test'

  const testAndSave = useCallback(async (values) => {
    const lud16Domain = walletLud16Domain(wallet.name)
    values = normalizeTestValues(protocol, values)
    if (values.address && lud16Domain) {
      values.address = `${values.address}@${lud16Domain}`
    }

    if (values.enabled !== false) {
      if (protocol.send) {
        const additionalValues = await testSendPayment(values)
        values = { ...values, ...additionalValues }
      } else {
        await testCreateInvoice(values)
      }
    }

    setFormState(values)
    return values
  }, [protocol, wallet, setFormState, testSendPayment, testCreateInvoice])

  const onTest = useCallback(async (values) => {
    const testValues = normalizeTestValues(protocol, values)
    const fingerprint = valuesFingerprint(testValues)
    setTestState(prev => ({
      ...prev,
      [formId]: { status: TestStatus.TESTING, error: null, fingerprint, protocol }
    }))

    try {
      await testAndSave(values)
      setTestState(prev => ({
        ...prev,
        [formId]: { status: TestStatus.TESTED, error: null, fingerprint, protocol }
      }))
    } catch (err) {
      const { message, details } = testErrorDetails(err, protocol)
      setTestState(prev => ({
        ...prev,
        [formId]: {
          status: TestStatus.FAILED,
          error: message,
          details,
          fingerprint,
          protocol
        }
      }))
    }
  }, [formId, protocol, setTestState, testAndSave])

  const onInvalid = useCallback((errors, values) => {
    const testValues = normalizeTestValues(protocol, values)
    const fingerprint = valuesFingerprint(testValues)
    const { message, details } = testErrorDetails(
      { message: firstValidationError(errors) || 'fix validation errors before testing' },
      protocol
    )
    setTestState(prev => ({
      ...prev,
      [formId]: {
        status: TestStatus.FAILED,
        error: message,
        details,
        fingerprint,
        protocol
      }
    }))
  }, [formId, protocol, setTestState])

  return (
    <Form
      enableReinitialize
      initial={initial}
      schema={schema}
      onSubmit={onTest}
      className={styles.capabilityForm}
    >
      <CapabilityFormStatusTracker
        protocol={protocol}
        fields={fields}
        savedFingerprint={valuesFingerprint(normalizeTestValues(protocol, persistedProtocolValues(protocol, fields, wallet)))}
        setTestState={setTestState}
      />
      {fields.length === 0 && (
        <p className='text-muted mb-0'>
          No configuration needed for {protocolDisplayName(protocol)}.
        </p>
      )}
      {fields.map(field => <WalletProtocolFormField key={field.name} protocol={protocol} onNwcLud16={onNwcLud16} {...field} />)}

      {error && <CapabilityError message={error} details={details} protocol={protocol} />}

      <CapabilityTestRow protocol={protocol} fields={fields} status={status} action={action} onTest={onTest} onInvalid={onInvalid} />
      <CapabilityStateRow
        protocol={protocol}
        testAndSave={testAndSave}
        setTestState={setTestState}
        onRemove={onRemove}
        onCancel={onCancel}
      />
    </Form>
  )
}

function CapabilityTestRow ({ protocol, fields, status, action, onTest, onInvalid }) {
  const { values } = useFormikContext()
  if (values.enabled === false) return null

  return (
    <div className={styles.capabilityTestRow}>
      <span>
        {protocol.send
          ? 'Test that this wallet can send payments.'
          : 'Test that this wallet can create invoices.'}
      </span>
      <CapabilityTestButton protocol={protocol} fields={fields} status={status} action={action} onTest={onTest} onInvalid={onInvalid} />
    </div>
  )
}

function CapabilityStateRow ({ protocol, testAndSave, setTestState, onRemove, onCancel }) {
  const formik = useFormikContext()
  const enabled = formik.values.enabled !== false
  const showToggle = !isTemplate(protocol)
  const formId = protocolFormId(protocol)

  const onEnabledChange = useCallback(async (e) => {
    const enabled = e.target.checked
    const values = { ...formik.values, enabled }
    const fingerprint = valuesFingerprint(normalizeTestValues(protocol, values))
    await formik.setFieldValue('enabled', enabled)

    if (!enabled) {
      await testAndSave(values)
    }

    setTestState(prev => ({
      ...prev,
      [formId]: {
        status: enabled ? TestStatus.NEEDS_TEST : TestStatus.SAVED,
        error: null,
        details: null,
        fingerprint,
        protocol
      }
    }))
  }, [formId, formik, protocol, setTestState, testAndSave])

  if (!showToggle && !onRemove && !onCancel) return null

  return (
    <div className={styles.capabilityStateRow}>
      {onRemove && (
        <button
          type='button'
          className={styles.capabilityRemoveButton}
          onClick={onRemove}
        >
          remove {protocol.send ? 'send' : 'receive'}
        </button>
      )}
      {onCancel && (
        <button
          type='button'
          className={styles.capabilityCancelButton}
          onClick={onCancel}
        >
          cancel {protocol.send ? 'send' : 'receive'}
        </button>
      )}
      {showToggle && (
        <label className={styles.capabilitySwitch}>
          <input
            type='checkbox'
            role='switch'
            name='enabled'
            checked={enabled}
            onChange={onEnabledChange}
          />
          <span className={styles.capabilitySwitchTrack} aria-hidden='true' />
          <span className={styles.capabilitySwitchLabel}>{enabled ? 'enabled' : 'disabled'}</span>
        </label>
      )}
    </div>
  )
}

function CapabilityTestButton ({ protocol, fields, status, action, onTest, onInvalid }) {
  const formik = useFormikContext()
  const testing = status === TestStatus.TESTING

  const handleTest = async () => {
    const errors = await formik.validateForm()
    formik.setTouched(touchedFields(fields), true)
    if (Object.keys(errors).length > 0) {
      onInvalid(errors, formik.values)
      return
    }
    await onTest(formik.values)
  }

  return (
    <button
      type='button'
      className={styles.capabilityTestButton}
      disabled={testing || formik.isSubmitting}
      onClick={handleTest}
    >
      {testing ? `testing ${protocolLogName(protocol)}...` : action}
    </button>
  )
}

function CapabilityError ({ message, details, protocol }) {
  const [showDetails, setShowDetails] = useState(false)
  const toaster = useToast()

  const copyDetails = async () => {
    try {
      await copy(details || message)
      toaster.success('copied details')
    } catch (err) {
      console.error('failed to copy wallet test details:', err)
      toaster.danger('failed to copy details')
    }
  }

  return (
    <div className={styles.capabilityError}>
      <div className={styles.capabilityErrorMessage}>{message}</div>
      <div className={styles.capabilityErrorActions}>
        {details && (
          <button
            type='button'
            className={styles.capabilityErrorAction}
            aria-expanded={showDetails}
            onClick={() => setShowDetails(show => !show)}
          >
            {showDetails ? 'hide details' : 'show details'}
          </button>
        )}
        <button type='button' className={styles.capabilityErrorAction} onClick={copyDetails}>copy details</button>
      </div>
      {details && showDetails && <pre className={styles.capabilityErrorDetails}>{details}</pre>}
    </div>
  )
}

function CapabilityFormStatusTracker ({ protocol, fields, savedFingerprint, setTestState }) {
  const { values } = useFormikContext()
  const [formState, setFormState] = useWalletFormState()
  const formId = protocolFormId(protocol)
  const configured = formState[formId]?.enabled !== false && hasProtocolConfig(formState[formId])
  const fingerprint = useMemo(() => valuesFingerprint(normalizeTestValues(protocol, values)), [protocol, values])
  const hasValues = useMemo(() => hasFormValues(values, fields), [values, fields])

  useEffect(() => {
    if (!hasValues && hasProtocolConfig(formState[formId])) {
      setFormState(formId, {
        name: protocol.name,
        send: protocol.send,
        __typename: isTemplate(protocol) ? 'WalletProtocolTemplate' : 'WalletProtocol',
        enabled: false,
        config: {}
      })
    }

    setTestState(prev => {
      const current = prev[formId]
      const nextStatus = getNextTestStatus({ current, configured, fingerprint, hasValues, saved: isSavedProtocol(formState[formId]), savedFingerprint, disabled: values.enabled === false })
      if (!nextStatus) return prev

      return {
        ...prev,
        [formId]: {
          status: nextStatus,
          error: nextStatus === TestStatus.FAILED ? current?.error : null,
          details: nextStatus === TestStatus.FAILED ? current?.details : null,
          fingerprint,
          protocol
        }
      }
    })
  }, [configured, fingerprint, formId, formState, hasValues, protocol, savedFingerprint, setFormState, setTestState])

  return null
}

function getNextTestStatus ({ current, configured, fingerprint, hasValues, saved, savedFingerprint, disabled }) {
  if (current?.status === TestStatus.TESTING) return null
  if (current?.status === TestStatus.FAILED && current.fingerprint === fingerprint) return null

  if (!hasValues) {
    if (!current || current.status === TestStatus.NOT_SET) return null
    return TestStatus.NOT_SET
  }

  if (disabled) {
    if (current?.status === TestStatus.SAVED && current.fingerprint === fingerprint) return null
    return TestStatus.SAVED
  }

  if (saved && fingerprint === savedFingerprint) {
    if (current?.status === TestStatus.SAVED && current.fingerprint === fingerprint) return null
    return TestStatus.SAVED
  }

  if (!current) return TestStatus.NEEDS_TEST
  if (current.status === TestStatus.TESTED && current.fingerprint === fingerprint) return null
  if (current.status === TestStatus.NEEDS_TEST && current.fingerprint === fingerprint) return null
  return TestStatus.NEEDS_TEST
}

function WalletProtocolFormField ({ protocol, type, onNwcLud16, ...props }) {
  const wallet = useWallet()
  const formik = useFormikContext()

  function transform ({ validate, encrypt, editable, help, share, ...props }) {
    const [upperHint, bottomHint] = Array.isArray(props.hint) ? props.hint : [null, props.hint]

    const parseHelpText = text => Array.isArray(text) ? text.join('\n\n') : text
    const _help = help
      ? (
          typeof help === 'string'
            ? { label: null, text: help }
            : (
                Array.isArray(help)
                  ? { label: null, text: parseHelpText(help) }
                  : { label: help.label, text: parseHelpText(help.text) }
              )
        )
      : null

    const readOnly = !!protocol.config?.[props.name] && editable === false

    const label = (
      <div className='d-flex align-items-center'>
        {props.label}
        {_help && (
          <Info label={_help.label}>
            <Text>{_help.text}</Text>
          </Info>
        )}
        <small className={classNames('text-muted', !help && 'ms-2')}>
          {upperHint
            ? <Text>{upperHint}</Text>
            : (!props.required ? 'optional' : null)}
        </small>
      </div>
    )

    let append, onPaste, onChange
    const lud16Domain = walletLud16Domain(wallet.name)
    if (props.name === 'address' && lud16Domain) {
      append = <InputGroup.Text className='text-monospace'>@{lud16Domain}</InputGroup.Text>
      onPaste = (e) => {
        e.preventDefault()
        const value = (e.clipboardData || window.clipboardData).getData('text')
        formik.setFieldValue(
          props.name,
          value.endsWith(`@${lud16Domain}`)
            ? value.slice(0, -`@${lud16Domain}`.length)
            : value
        )
      }
    }

    if (protocol.name === 'NWC' && protocol.send && props.name === 'url') {
      onChange = (formik, e) => {
        try {
          const { lud16 } = parseNwcUrl(e.target.value)
          if (lud16) onNwcLud16?.(lud16)
        } catch {
          // Ignore partial NWC strings while the user is still typing.
        }
      }
    }

    return { ...props, hint: bottomHint, label, readOnly, append, onPaste, onChange }
  }

  switch (type) {
    case 'text': {
      return <Input {...transform(props)} />
    }
    case 'password':
      return <PasswordInput {...transform(props)} />
    default:
      return null
  }
}

function CapabilityStatus ({ status }) {
  return (
    <span className={classNames(styles.capabilityStatus, capabilityStatusClass(status))}>
      {[TestStatus.SAVED, TestStatus.TESTED].includes(status) && <CheckCircle width={14} height={14} />}
      {statusLabel(status)}
    </span>
  )
}

function statusLabel (status) {
  switch (status) {
    case TestStatus.SAVED:
      return 'saved'
    case TestStatus.TESTED:
      return 'tested'
    case TestStatus.TESTING:
      return 'testing'
    case TestStatus.NEEDS_TEST:
      return 'needs test'
    case TestStatus.FAILED:
      return 'failed'
    default:
      return 'not set'
  }
}

function capabilityStatusClass (status) {
  switch (status) {
    case TestStatus.SAVED:
    case TestStatus.TESTED:
      return styles.testedCapabilityStatus
    case TestStatus.TESTING:
      return styles.testingCapabilityStatus
    case TestStatus.NEEDS_TEST:
      return styles.needsTestCapabilityStatus
    case TestStatus.FAILED:
      return styles.errorCapabilityStatus
    default:
      return styles.notSetCapabilityStatus
  }
}

function getCapabilityStatus (protocol, test) {
  if (test?.status) return test.status
  if (isSavedProtocol(protocol) && protocol.enabled !== false && hasProtocolConfig(protocol)) return TestStatus.SAVED
  if (protocol?.enabled !== false && hasProtocolConfig(protocol)) return TestStatus.TESTED
  return TestStatus.NOT_SET
}

function isSavedProtocol (protocol) {
  return !!protocol?.id && !!protocol?.__typename && !isTemplate(protocol)
}

function isProtocolReadyToSave (protocol, testState) {
  const status = getCapabilityStatus(protocol, testState[protocolFormId(protocol)])
  return [TestStatus.SAVED, TestStatus.TESTED].includes(status)
}

function statusBlockerMessage ({ status, protocol }) {
  if (status === TestStatus.TESTING) return 'wait for test to finish'
  if (status === TestStatus.FAILED) return 'fix failed test before saving'
  return 'run capability tests before saving'
}

function normalizeTestValues (protocol, values) {
  return {
    ...values,
    enabled: isTemplate(protocol) ? true : values.enabled
  }
}

function persistedProtocolValues (protocol, fields, wallet) {
  const lud16Domain = walletLud16Domain(wallet.name)
  return fields.reduce((acc, field) => {
    let value = protocol.config?.[field.name]
    if (protocol.name === 'LN_ADDR' && field.name === 'address' && lud16Domain && value) {
      value = value.split('@')[0]
    }
    return {
      ...acc,
      [field.name]: value || ''
    }
  }, { enabled: protocol.enabled })
}

function testErrorDetails (err, protocol) {
  const side = protocol.send ? 'send' : 'receive'
  const message = err?.graphQLErrors?.[0]?.message || err?.message || 'test failed'
  const detailLines = [
    `${protocolLogName(protocol)} ${side} failed: ${message}`,
    ...errorDetailLines(err),
    err?.stack
  ].filter(Boolean)

  return {
    message: `${protocolDisplayName(protocol)} ${side} failed: ${message}`,
    details: detailLines.join('\n\n')
  }
}

function errorDetailLines (err) {
  return [
    ...err?.graphQLErrors?.map((error, i) => {
      const parts = [`GraphQL error ${i + 1}: ${error.message}`]
      if (error.path) parts.push(`path: ${error.path.join('.')}`)
      if (error.extensions?.code) parts.push(`code: ${error.extensions.code}`)
      return parts.join('\n')
    }) ?? [],
    err?.networkError && `Network error: ${err.networkError.message}`,
    err?.cause && `Cause: ${err.cause.message || err.cause.toString?.()}`
  ]
}

function firstValidationError (errors) {
  if (!errors) return null
  if (typeof errors === 'string') return errors
  if (Array.isArray(errors)) return errors.map(firstValidationError).find(Boolean)
  return Object.values(errors).map(firstValidationError).find(Boolean)
}

function touchedFields (fields) {
  return fields.reduce((acc, field) => ({ ...acc, [field.name]: true }), {})
}

function valuesFingerprint (values) {
  return JSON.stringify(Object.keys(values ?? {}).sort().reduce((acc, key) => {
    acc[key] = values[key]
    return acc
  }, {}))
}

function hasFormValues (values, fields = []) {
  if (!values) return false
  if (fields.length === 0) return values.enabled !== false
  return Object.entries(values).some(
    ([key, value]) => key !== 'enabled' && value !== '' && value !== false && value !== undefined && value !== null
  )
}
