import { useCallback, useMemo, useRef, useEffect } from 'react'
import { InputGroup, Nav } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import navStyles from '@/styles/nav.module.css'
import { Checkbox, Form, Input, PasswordInput, SubmitButton } from '@/components/form'
import CancelButton from '@/components/cancel-button'
import Text from '@/components/text'
import Info from '@/components/info'
import { useFormState, useNext, useStep, useStepIndex } from '@/components/multi-step-form'
import { isTemplate, protocolDisplayName, protocolFields, protocolFormId, protocolLogName, walletLud16Domain } from '@/wallets/lib/util'
import { WalletGuide, WalletLayout, WalletLayoutHeader, WalletLayoutImageOrName, WalletLogs } from '@/wallets/client/components'
import { TemplateLogsProvider, useTestSendPayment, useWalletLogger, useTestCreateInvoice, useWalletSupport } from '@/wallets/client/hooks'
import ArrowRight from '@/svgs/arrow-right-s-fill.svg'
import ArrowUpRight from '@/svgs/arrow-right-up-line.svg'
import ArrowDownLeft from '@/svgs/arrow-left-down-line.svg'
import CheckCircle from '@/svgs/checkbox-circle-fill.svg'
import { useFormikContext } from 'formik'
import { WalletMultiStepFormContextProvider, Step, useWallet, useWalletProtocols, useProtocol, useProtocolForm, useSaveWallet, useSaveCurrentForm, hasProtocolConfig } from './hooks'
import { BackButton, SkipButton } from './button'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'

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

  const support = useWalletSupport(wallet)
  const steps = useMemo(() =>
    [
      support.send && Step.SEND,
      support.receive && Step.RECEIVE,
      Step.CONFIRM
    ].filter(Boolean),
  [support])

  return (
    <WalletLayout>
      <div className={styles.form}>
        <WalletLayoutHeader>
          <WalletLayoutImageOrName name={wallet.name} maxHeight='80px' />
        </WalletLayoutHeader>
        <WalletGuide name={wallet.name} />
        <WalletMultiStepFormContextProvider wallet={wallet} initial={initial} steps={steps}>
          {steps.map(step => {
            // WalletForm is aware of the current step via hooks
            // and can thus render a different form for send vs. receive
            if (step === Step.CONFIRM) return <WalletConfirmStep key={step} />
            return <WalletForm key={step} />
          })}
        </WalletMultiStepFormContextProvider>
      </div>
    </WalletLayout>
  )
}

function WalletForm () {
  return (
    <TemplateLogsProvider>
      <WalletProtocolSelector />
      <WalletProtocolForm />
    </TemplateLogsProvider>
  )
}

function WalletProtocolSelector () {
  const protocols = useWalletProtocols()
  const [protocol, selectProtocol] = useProtocol()
  const [saveCurrentForm] = useSaveCurrentForm()
  const step = useStep()
  const isSend = step === Step.SEND
  const logger = useWalletLogger(protocol)

  const handleTabClick = useCallback(async (p) => {
    // don't do anything if clicking the already selected protocol
    if (p.name === protocol?.name) return

    // if there's a current form, save/validate it first
    if (saveCurrentForm) {
      try {
        await saveCurrentForm()
      } catch (err) {
        // validation failed, don't switch tabs
        logger.error(err.message)
        return
      }
    }
    selectProtocol(p)
  }, [protocol, saveCurrentForm, selectProtocol])

  // don't show selector if there's only one protocol option
  if (protocols.length <= 1) return null

  return (
    <div className={styles.protocolSelector}>
      <div className={styles.protocolSelectorHeader}>
        {isSend ? 'Send protocol' : 'Receive protocol'}
      </div>
      <Nav className={classNames(navStyles.nav, 'mt-0')} activeKey={protocol?.name}>
        {
          protocols.map(p => {
            return (
              <Nav.Item key={p.id} onClick={() => handleTabClick(p)}>
                <Nav.Link eventKey={p.name}>
                  {protocolDisplayName(p)}
                </Nav.Link>
              </Nav.Item>
            )
          })
        }
      </Nav>
    </div>
  )
}

function WalletProtocolForm () {
  const wallet = useWallet()
  const [protocol] = useProtocol()
  const next = useNext()
  const testSendPayment = useTestSendPayment(protocol)
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const logger = useWalletLogger(protocol)
  const [{ fields, initial, schema }, setFormState] = useProtocolForm(protocol)

  // validate and save form values (used by both submit and tab switch)
  const validateAndSave = useCallback(async (values) => {
    const lud16Domain = walletLud16Domain(wallet.name)
    if (values.address && lud16Domain) {
      values.address = `${values.address}@${lud16Domain}`
    }

    const name = protocolLogName(protocol)

    if (isTemplate(protocol)) {
      values.enabled = true
    }

    if (values.enabled) {
      if (protocol.send) {
        logger.info(`testing ${name} send ...`)
        const additionalValues = await testSendPayment(values)
        values = { ...values, ...additionalValues }
        logger.ok(`${name} send ok`)
      } else {
        logger.info(`testing ${name} receive ...`)
        await testCreateInvoice(values)
        logger.ok(`${name} receive ok`)
      }
    }

    setFormState(values)
    return values
  }, [protocol, wallet, setFormState, testSendPayment, testCreateInvoice, logger])

  // form submit handler - validates, saves, and navigates to next step
  const onSubmit = useCallback(async ({ ...values }) => {
    try {
      await validateAndSave(values)
      next()
    } catch (err) {
      logger.error(err.message)
      throw err
    }
  }, [validateAndSave, next, logger])

  return (
    <>
      <Form
        key={`form-${protocol.id}`}
        enableReinitialize
        initial={initial}
        schema={schema}
        onSubmit={onSubmit}
      >
        <FormTabSwitchHandler validateAndSave={validateAndSave} setFormState={setFormState} />
        {fields.length === 0 && (
          <p className='text-muted'>
            No configuration needed for {protocolDisplayName(protocol)}.
          </p>
        )}
        {fields.map(field => <WalletProtocolFormField key={field.name} {...field} />)}
        {!isTemplate(protocol) && <Checkbox name='enabled' label='enabled' />}
        <WalletProtocolFormNavigator />
      </Form>
      <WalletLogs className='mt-3' protocol={protocol} key={`logs-${protocol.id}`} />
    </>
  )
}

// check if form values have meaningful content worth validating
function hasFormValues (values) {
  if (!values) return false
  if (values.enabled) return true
  // check if any non-enabled fields have values
  return Object.entries(values).some(
    ([key, value]) => key !== 'enabled' && value !== '' && value !== false && value !== undefined && value !== null
  )
}

// registers a save function for tab switching (validates before switch)
function FormTabSwitchHandler ({ validateAndSave, setFormState }) {
  const { values } = useFormikContext()
  const [, setSaveCurrentForm] = useSaveCurrentForm()
  const valuesRef = useRef(values)

  // keep ref updated with latest values
  useEffect(() => {
    valuesRef.current = values
  }, [values])

  // register save function on mount, clear on unmount
  useEffect(() => {
    // create a save function that uses current form values
    const saveFunction = async () => {
      const currentValues = { ...valuesRef.current }
      // skip validation for empty forms, just save the state
      if (!hasFormValues(currentValues)) {
        setFormState(currentValues)
        return
      }
      await validateAndSave(currentValues)
    }
    setSaveCurrentForm(() => saveFunction)

    return () => {
      setSaveCurrentForm(null)
    }
  }, [validateAndSave, setFormState, setSaveCurrentForm])

  return null
}

function WalletProtocolFormNavigator () {
  const stepIndex = useStepIndex()

  return (
    <div className='d-flex justify-content-end align-items-center'>
      <div className='me-auto'>
        {stepIndex === 0 ? <CancelButton>cancel</CancelButton> : <BackButton />}
      </div>
      <SkipButton />
      <SubmitButton variant='primary' className='ps-3 pe-2 d-flex align-items-center'>
        next
        <ArrowRight width={24} height={24} />
      </SubmitButton>
    </div>
  )
}

function WalletProtocolFormField ({ type, ...props }) {
  const wallet = useWallet()
  const [protocol] = useProtocol()
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

    let append, onPaste
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

    return { ...props, hint: bottomHint, label, readOnly, append, onPaste }
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

function WalletConfirmStep () {
  const [formState] = useFormState()
  const saveWallet = useSaveWallet()
  const toaster = useToast()
  const router = useRouter()

  const onSubmit = useCallback(async () => {
    try {
      await saveWallet()
      toaster.success('wallet saved')
      router.push('/wallets')
    } catch (err) {
      console.error(err)
      toaster.danger('failed to save wallet')
    }
  }, [saveWallet, toaster, router])

  // group configured protocols by type (send vs receive), filtering out empty ones
  const sendProtocols = Object.values(formState).filter(p => p?.send && hasProtocolConfig(p))
  const receiveProtocols = Object.values(formState).filter(p => p && !p.send && hasProtocolConfig(p))

  const hasConfig = sendProtocols.length > 0 || receiveProtocols.length > 0

  return (
    <div className={styles.confirmStep}>
      {!hasConfig
        ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>?</div>
            <p>No protocols configured</p>
            <small className='text-muted'>Go back to configure send or receive protocols</small>
          </div>
          )
        : (
          <div className={styles.reviewSections}>
            {sendProtocols.length > 0 && (
              <div className={styles.reviewSection}>
                <div className={styles.sectionHeader}>
                  <div className={classNames(styles.sectionIcon, styles.sendIcon)}>
                    <ArrowUpRight width={16} height={16} />
                  </div>
                  <span>Send</span>
                </div>
                <div className={styles.protocolList}>
                  {sendProtocols.map(protocol => (
                    <ProtocolReviewCard key={protocol.id || protocol.name} protocol={protocol} />
                  ))}
                </div>
              </div>
            )}
            {receiveProtocols.length > 0 && (
              <div className={styles.reviewSection}>
                <div className={styles.sectionHeader}>
                  <div className={classNames(styles.sectionIcon, styles.receiveIcon)}>
                    <ArrowDownLeft width={16} height={16} />
                  </div>
                  <span>Receive</span>
                </div>
                <div className={styles.protocolList}>
                  {receiveProtocols.map(protocol => (
                    <ProtocolReviewCard key={protocol.id || protocol.name} protocol={protocol} />
                  ))}
                </div>
              </div>
            )}
          </div>
          )}
      <div className='d-flex justify-content-end align-items-center mt-4'>
        <div className='me-auto'>
          <BackButton />
        </div>
        <button
          type='button'
          className='btn btn-primary d-flex align-items-center'
          onClick={onSubmit}
          disabled={!hasConfig}
        >
          <CheckCircle width={16} height={16} className='me-2' />
          save wallet
        </button>
      </div>
    </div>
  )
}

function ProtocolReviewCard ({ protocol }) {
  const displayName = protocolDisplayName(protocol)
  const isEnabled = protocol.enabled
  // only show fields that are defined in the protocol schema (not internal values)
  const fields = protocolFields(protocol)
  const fieldNames = new Set(fields.map(f => f.name))
  const configEntries = Object.entries(protocol.config || {})
    .filter(([key, value]) => value && fieldNames.has(key))

  // get field label or fallback to key name
  const getFieldLabel = (key) => {
    const field = fields.find(f => f.name === key)
    return field?.label || key
  }

  // mask sensitive values
  const maskValue = (key, value) => {
    const field = fields.find(f => f.name === key)
    if (field?.encrypt) {
      return '••••••••'
    }
    if (typeof value === 'string' && value.length > 40) {
      return `${value.slice(0, 20)}...${value.slice(-8)}`
    }
    return String(value)
  }

  return (
    <div className={classNames(styles.reviewCard, !isEnabled && styles.reviewCardDisabled)}>
      <div className={styles.reviewCardHeader}>
        <span className={styles.protocolName}>{displayName}</span>
        {isEnabled
          ? <CheckCircle width={14} height={14} className={styles.checkIcon} />
          : <span className={styles.disabledBadge}>disabled</span>}
      </div>
      {configEntries.length > 0 && (
        <div className={styles.configList}>
          {configEntries.map(([key, value]) => (
            <div key={key} className={styles.configItem}>
              <span className={styles.configKey}>{getFieldLabel(key)}</span>
              <span className={styles.configValue}>{maskValue(key, value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
