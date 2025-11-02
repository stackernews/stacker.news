import { useCallback, useMemo } from 'react'
import { InputGroup, Nav } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import navStyles from '@/styles/nav.module.css'
import { Checkbox, Form, Input, PasswordInput, SubmitButton } from '@/components/form'
import CancelButton from '@/components/cancel-button'
import Text from '@/components/text'
import Info from '@/components/info'
import { useIsFirstStep, useIsLastStep, useNext } from '@/components/multi-step-form'
import { isTemplate, protocolDisplayName, protocolFormId, protocolLogName, walletLud16Domain } from '@/wallets/lib/util'
import { WalletGuide, WalletLayout, WalletLayoutHeader, WalletLayoutImageOrName, WalletLogs } from '@/wallets/client/components'
import { TemplateLogsProvider, useTestSendPayment, useWalletLogger, useTestCreateInvoice, useWalletSupport } from '@/wallets/client/hooks'
import ArrowRight from '@/svgs/arrow-right-s-fill.svg'
import { useFormikContext } from 'formik'

import { WalletMultiStepFormContextProvider, Step, useWallet, useWalletProtocols, useProtocol, useProtocolForm, useSaveWallet } from './hooks'
import { BackButton, SkipButton } from './button'

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
      support.receive && Step.RECEIVE
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
            if (step === Step.SEND) return <WalletForm key={step} />
            if (step === Step.RECEIVE) return <WalletForm key={step} />
            return null
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
    <Nav className={classNames(navStyles.nav, 'mt-0')} activeKey={protocol?.name}>
      {
        protocols.map(p => {
          return (
            <Nav.Item key={p.id} onClick={() => selectProtocol(p)}>
              <Nav.Link eventKey={p.name}>
                {protocolDisplayName(p)}
              </Nav.Link>
            </Nav.Item>
          )
        })
      }
    </Nav>
  )
}

function WalletProtocolForm () {
  const wallet = useWallet()
  const [protocol] = useProtocol()

  // on the last step, we save the wallet, otherwise we just go to the next step
  const isLastStep = useIsLastStep()
  const formNext = useNext()
  const formSave = useSaveWallet()

  const testSendPayment = useTestSendPayment(protocol)
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const logger = useWalletLogger(protocol)
  const [{ fields, initial, schema }, setFormState] = useProtocolForm(protocol)

  const next = useCallback(() => {
    isLastStep ? formSave() : formNext()
  }, [isLastStep, formSave, formNext])

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
  // show 'cancel' in the first step
  const showCancel = useIsFirstStep()
  // show 'save' instead of 'next' in the last step
  const isLastStep = useIsLastStep()
  // show 'skip' if there's a next step
  const showSkip = !isLastStep

  return (
    <div className='d-flex justify-content-end align-items-center'>
      {showCancel ? <CancelButton>cancel</CancelButton> : <BackButton />}
      {showSkip ? <SkipButton /> : <div className='ms-auto' />}
      {
        isLastStep
          ? (
            <SubmitButton variant='primary' className='d-flex align-items-center'>
              save
            </SubmitButton>
            )
          : (
            <SubmitButton variant='primary' className='ps-3 pe-2 d-flex align-items-center'>
              next
              <ArrowRight width={24} height={24} />
            </SubmitButton>
            )
      }
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
