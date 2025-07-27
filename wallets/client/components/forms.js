import { useCallback, useMemo, createContext, useContext, useState } from 'react'
import { Button, InputGroup } from 'react-bootstrap'
import { useRouter } from 'next/router'
import { WalletLayout, WalletLayoutHeader, WalletLayoutImageOrName, WalletLogs, WalletSettings } from '@/wallets/client/components'
import { protocolDisplayName, protocolFields, protocolClientSchema, isWallet, isTemplate, walletLud16Domain } from '@/wallets/lib/util'
import styles from '@/styles/wallet.module.css'
import { Checkbox, Form, Input, PasswordInput, SubmitButton } from '@/components/form'
import CancelButton from '@/components/cancel-button'
import { useWalletProtocolRemove, useWalletQuery, TemplateLogsProvider, useTestSendPayment, useWalletLogger, useTestCreateInvoice } from '@/wallets/client/hooks'
import Text from '@/components/text'
import Info from '@/components/info'
import classNames from 'classnames'

const WalletFormsContext = createContext()

const PROGRESS = {
  SEND: 0,
  RECEIVE: 1,
  SETTINGS: 2
}

export function WalletForms ({ id, name }) {
  // TODO(wallet-v2): handle loading and error states
  const { data, refetch } = useWalletQuery({ name, id })
  const wallet = data?.wallet

  const [progress, setProgress] = useState(PROGRESS.SEND)
  // save form state since we submit protocols at the end
  const [formState, setFormState] = useState()
  // the useProtocol hook will return the first available protocol if no protocol is selected
  const [protocol, setProtocol] = useState(null)

  const skip = useCallback(() => {
    setProgress(progress => progress + 1)
  }, [])

  const back = useCallback(() => {
    setProgress(progress => progress - 1)
  }, [])

  const updateFormState = useCallback((protocol, state) => {
    if (progress === PROGRESS.SEND) {
      setFormState(fs => ({ ...fs, send: { [protocol.id]: state } }))
    } else if (progress === PROGRESS.RECEIVE) {
      setFormState(fs => ({ ...fs, receive: { [protocol.id]: state } }))
    } else if (progress === PROGRESS.SETTINGS) {
      setFormState(fs => ({ ...fs, settings: { [protocol.id]: state } }))
    }
    setProgress(progress => progress + 1)
  }, [progress])

  const value = useMemo(
    () => ({
      refetch,
      wallet,
      progress,
      protocol,
      setProtocol,
      back,
      skip,
      formState,
      updateFormState
    }),
    [refetch, wallet, progress, protocol, setProtocol, back, skip, formState, setFormState])

  return (
    <WalletLayout>
      <div className={styles.form}>
        <WalletLayoutHeader>
          {wallet && <WalletLayoutImageOrName name={wallet.name} maxHeight='80px' />}
        </WalletLayoutHeader>
        {wallet && (
          <WalletFormsContext.Provider value={value}>
            <WalletFormSelector />
          </WalletFormsContext.Provider>
        )}
      </div>
    </WalletLayout>
  )
}

function useWalletRefetch () {
  const { refetch } = useContext(WalletFormsContext)
  return refetch
}

function useWallet () {
  const { wallet } = useContext(WalletFormsContext)
  return wallet
}

function useProgress () {
  const { progress } = useContext(WalletFormsContext)
  return progress
}

function useUpdateFormState () {
  const { updateFormState } = useContext(WalletFormsContext)
  return updateFormState
}

function useFormState () {
  const progress = useProgress()
  const protocol = useProtocol()
  const { formState } = useContext(WalletFormsContext)

  const progressState = progress === PROGRESS.SEND
    ? formState?.send
    : progress === PROGRESS.RECEIVE
      ? formState?.receive
      : formState?.settings

  return progressState?.[protocol.id]
}

function useBack () {
  const { back } = useContext(WalletFormsContext)
  return back
}

function useSkip () {
  const { skip } = useContext(WalletFormsContext)
  return skip
}

function useProtocol () {
  const protocols = useWalletProtocols()
  const { protocol } = useContext(WalletFormsContext)
  return useMemo(() => protocol || protocols[0], [protocols, protocol])
}

function useSelectProtocol () {
  const { setProtocol } = useContext(WalletFormsContext)
  return setProtocol
}

function WalletFormSelector () {
  const progress = useProgress()

  return (
    <>
      <WalletProgress />
      <div className='position-relative'>
        {[PROGRESS.SEND, PROGRESS.RECEIVE].includes(progress)
          ? (
            <div>
              <WalletProtocolSelector />
              <TemplateLogsProvider>
                <WalletProtocolForm />
              </TemplateLogsProvider>
            </div>
            )
          : <WalletSettings />}
      </div>
    </>
  )
}

function WalletProgress () {
  const progress = useProgress()
  // XXX the margins were manually adjusted to connect the numbers
  //   if we'd use fw-bold when active, the margins need to be adjusted again ...
  // TODO: is there a way to connect the numbers without manual pixel tweaking?
  return (
    <div className='d-flex my-3 mx-auto'>
      <ProgressStep number={1} label='send' active={progress >= 0} />
      <ProgressLine style={{ marginLeft: '-4px', marginRight: '-13px' }} active={progress >= 1} />
      <ProgressStep number={2} label='receive' active={progress >= 1} />
      <ProgressLine style={{ marginLeft: '-12px', marginRight: '-15px' }} active={progress >= 2} />
      <ProgressStep number={3} label='settings' active={progress >= 2} />
    </div>
  )
}

function ProgressStep ({ number, label, active }) {
  return (
    <div className={classNames('text-center z-1', { 'text-info': active })}>
      <div className={classNames(styles.progressNumber, active ? 'bg-info text-white' : 'border text-muted')}>
        {number}
      </div>
      <div className={classNames('small pt-1', active ? 'text-info' : 'text-muted')}>
        {label}
      </div>
    </div>
  )
}

function ProgressLine ({ style, active }) {
  return (
    <div style={style}>
      <svg width='100%' height='1' viewBox='0 0 100 1' preserveAspectRatio='none'>
        <path
          d='M 0 1 L 100 1'
          stroke={active ? 'var(--bs-info)' : 'var(--theme-grey)'}
          strokeWidth='1'
          fill='none'
        />
      </svg>
    </div>
  )
}

function WalletProtocolSelector () {
  const protocols = useWalletProtocols()
  const protocol = useProtocol()
  const setProtocol = useSelectProtocol()

  return (
    <div className='d-flex gap-2 pointer'>
      {
        protocols.map(p => (
          <div
            key={p.id}
            className={classNames('flex-grow-1 mb-3 text-nowrap', { 'fw-bold border-bottom border-primary border-3': p.name === protocol?.name })}
            onClick={() => setProtocol(p)}
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
  const protocol = useProtocol()
  const updateFormState = useUpdateFormState()
  const testSendPayment = useTestSendPayment(protocol)
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const logger = useWalletLogger(protocol)
  const { fields, initial, schema } = useProtocolForm(protocol)

  // create a copy of values to avoid mutating the original
  const onSubmit = useCallback(async ({ ...values }) => {
    const lud16Domain = walletLud16Domain(wallet.name)
    if (values.address && lud16Domain) {
      values.address = `${values.address}@${lud16Domain}`
    }

    if (isTemplate(protocol)) {
      values.enabled = true
    }

    if (values.enabled) {
      try {
        if (protocol.send) {
          logger.info('testing send ...')
          const additionalValues = await testSendPayment(values)
          values = { ...values, ...additionalValues }
          logger.ok('send ok')
        } else {
          logger.info('testing receive ...')
          const additionalValues = await testCreateInvoice(values)
          values = { ...values, ...additionalValues }
          logger.ok('receive ok')
        }
      } catch (err) {
        logger.error(err.message)
        throw err
      }
    }

    updateFormState(protocol, values)
  }, [protocol, wallet, updateFormState, testSendPayment, logger])

  return (
    <>
      <Form
        key={protocol.id}
        enableReinitialize
        initial={initial}
        schema={schema}
        onSubmit={onSubmit}
      >
        {fields.map(field => <WalletProtocolFormField key={field.name} {...field} />)}
        {!isTemplate(protocol) && <Checkbox name='enabled' label='enabled' disabled={isTemplate(protocol)} />}
        <WalletProtocolFormButtons />
      </Form>
      <WalletLogs className='mt-3' protocol={protocol} />
    </>
  )
}

function WalletProtocolFormButtons () {
  const protocol = useProtocol()
  const removeWalletProtocol = useWalletProtocolRemove(protocol)
  const refetch = useWalletRefetch()
  const router = useRouter()
  const wallet = useWallet()
  const progress = useProgress()
  const isLastProtocol = wallet.protocols.length === 1

  const onDetach = useCallback(async () => {
    await removeWalletProtocol()
    if (isLastProtocol) {
      router.replace('/wallets', null, { shallow: true })
      return
    }
    refetch()
  }, [removeWalletProtocol, refetch, isLastProtocol, router])

  return (
    <div className='d-flex justify-content-end'>
      {!isTemplate(protocol) && <Button variant='grey-medium' className='me-auto' onClick={onDetach}>detach</Button>}
      {progress === PROGRESS.SEND ? <CancelButton>cancel</CancelButton> : <BackButton />}
      <SkipButton />
      <SubmitButton variant='primary'>{isWallet(wallet) ? 'save' : 'next'}</SubmitButton>
    </div>
  )
}

function BackButton () {
  const back = useBack()
  return <Button className='text-muted nav-link fw-bold' variant='link' onClick={back}>back</Button>
}

function SkipButton () {
  const skip = useSkip()
  return <Button className='ms-auto me-3 text-muted nav-link fw-bold' variant='link' onClick={skip}>skip</Button>
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

function useWalletProtocols () {
  const wallet = useWallet()
  const progress = useProgress()

  const send = progress === PROGRESS.SEND
  const protocolFilter = p => send ? p.send : !p.send

  return isWallet(wallet)
    ? wallet.template.protocols.filter(protocolFilter)
    : wallet.protocols.filter(protocolFilter)
}

function useProtocolForm (protocol) {
  const formState = useFormState()

  const wallet = useWallet()
  const lud16Domain = walletLud16Domain(wallet.name)
  const fields = protocolFields(protocol)
  const initial = fields.reduce((acc, field) => {
    // wallet templates don't have a config
    let value = protocol.config?.[field.name] ?? formState?.[field.name]

    if (field.name === 'address' && lud16Domain && value) {
      value = value.split('@')[0]
    }

    return {
      ...acc,
      [field.name]: value || ''
    }
  }, { enabled: protocol.enabled ?? formState?.enabled })

  let schema = protocolClientSchema(protocol)
  if (lud16Domain) {
    schema = schema.transform(({ address, ...rest }) => {
      return {
        address: address ? `${address}@${lud16Domain}` : '',
        ...rest
      }
    })
  }

  return { fields, initial, schema }
}
