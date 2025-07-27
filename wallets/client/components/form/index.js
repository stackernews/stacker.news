import { useCallback, useMemo } from 'react'
import { InputGroup } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import { Checkbox, Form, Input, PasswordInput, SubmitButton } from '@/components/form'
import CancelButton from '@/components/cancel-button'
import Text from '@/components/text'
import Info from '@/components/info'
import { useFormState, useMaxSteps, useNext, useStepIndex } from '@/components/multi-step-form'
import { isTemplate, isWallet, protocolDisplayName, protocolLogName, walletLud16Domain } from '@/wallets/lib/util'
import { WalletLayout, WalletLayoutHeader, WalletLayoutImageOrName, WalletLogs } from '@/wallets/client/components'
import { TemplateLogsProvider, useTestSendPayment, useWalletLogger, useTestCreateInvoice, useWalletSupport } from '@/wallets/client/hooks'

import { WalletMultiStepFormContextProvider, Step, useWallet, useWalletProtocols, useProtocol, useProtocolForm } from './hooks'
import { Settings } from './settings'
import { BackButton, SkipButton } from './button'

export function WalletMultiStepForm ({ wallet }) {
  const initial = useMemo(() => wallet.protocols.filter(p => !isTemplate(p)), [wallet])

  const support = useWalletSupport(wallet)
  const steps = useMemo(() =>
    [
      support.send && Step.SEND,
      support.receive && Step.RECEIVE,
      Step.SETTINGS
    ].filter(Boolean),
  [support])

  return (
    <WalletLayout>
      <div className={styles.form}>
        <WalletLayoutHeader>
          <WalletLayoutImageOrName name={wallet.name} maxHeight='80px' />
        </WalletLayoutHeader>
        <WalletMultiStepFormContextProvider wallet={wallet} initial={initial} steps={steps}>
          {steps.map(step => {
            // WalletForm is aware of the current step via hooks
            // and can thus render a different form for send vs. receive
            if (step === Step.SEND) return <WalletForm key={step} />
            if (step === Step.RECEIVE) return <WalletForm key={step} />
            return <Settings key={step} />
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

  return (
    <div className='d-flex gap-2 pointer'>
      {
        protocols.map(p => (
          <div
            key={p.id}
            className={classNames('flex-grow-1 mb-3 text-nowrap', { 'fw-bold border-bottom border-primary border-3': p.name === protocol?.name })}
            onClick={() => selectProtocol(p)}
          >
            {protocolDisplayName(p)}
          </div>
        ))
      }
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

  // create a copy of values to avoid mutating the original
  const onSubmit = useCallback(async ({ ...values }) => {
    const lud16Domain = walletLud16Domain(wallet.name)
    if (values.address && lud16Domain) {
      values.address = `${values.address}@${lud16Domain}`
    }

    const name = protocolLogName(protocol)

    if (isTemplate(protocol)) {
      values.enabled = true
    }

    if (values.enabled) {
      try {
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
      } catch (err) {
        logger.error(err.message)
        throw err
      }
    }

    setFormState(values)
    next()
  }, [protocol, wallet, setFormState, testSendPayment, logger, next])

  return (
    <>
      <Form
        key={`form-${protocol.id}`}
        enableReinitialize
        initial={initial}
        schema={schema}
        onSubmit={onSubmit}
      >
        {fields.map(field => <WalletProtocolFormField key={field.name} {...field} />)}
        {!isTemplate(protocol) && <Checkbox name='enabled' label='enabled' />}
        <WalletProtocolFormNavigator />
      </Form>
      <WalletLogs className='mt-3' protocol={protocol} key={`logs-${protocol.id}`} />
    </>
  )
}

function WalletProtocolFormNavigator () {
  const wallet = useWallet()
  const stepIndex = useStepIndex()
  const maxSteps = useMaxSteps()
  const [formState] = useFormState()

  // was something already configured or was something configured just now?
  const configExists = (isWallet(wallet) && wallet.protocols.length > 0) || formState.length > 0

  // don't allow going to settings as last step with nothing configured
  const hideSkip = stepIndex === maxSteps - 2 && !configExists

  return (
    <div className='d-flex justify-content-end'>
      {stepIndex === 0 ? <CancelButton>cancel</CancelButton> : <BackButton />}
      {!hideSkip ? <SkipButton /> : <div className='ms-auto' />}
      <SubmitButton variant='primary'>next</SubmitButton>
    </div>
  )
}

function WalletProtocolFormField ({ type, ...props }) {
  const wallet = useWallet()
  const protocol = useProtocol()

  function transform ({ validate, encrypt, editable, help, ...props }) {
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
        <small className='text-muted ms-2'>
          {upperHint
            ? <Text>{upperHint}</Text>
            : (!props.required ? 'optional' : null)}
        </small>
      </div>
    )

    return { ...props, hint: bottomHint, label, readOnly }
  }

  switch (type) {
    case 'text': {
      let append
      const lud16Domain = walletLud16Domain(wallet.name)
      if (props.name === 'address' && lud16Domain) {
        append = <InputGroup.Text className='text-monospace'>@{lud16Domain}</InputGroup.Text>
      }
      return <Input {...transform(props)} append={append} />
    }
    case 'password':
      return <PasswordInput {...transform(props)} />
    default:
      return null
  }
}
