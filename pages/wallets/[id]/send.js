import { getGetServerSideProps } from '@/api/ssrApollo'
import { Checkbox, Form, Input, SubmitButton } from '@/components/form'
import { useMe } from '@/components/me'
import { useToast } from '@/components/toast'
import useDebounceCallback from '@/components/use-debounce-callback'
import { lnAddrOptions } from '@/lib/lnurl'
import { WalletErrorShell, WalletLayoutImageOrName, WalletLoadingShell, WalletRouteGateShell, WalletShell } from '@/wallets/client/components'
import { formatWalletBalance, useWalletCardBalance } from '@/wallets/client/components/card'
import { useWalletStatus, useWalletSupport, useWallets } from '@/wallets/client/hooks'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import { protocolSendPayment } from '@/wallets/client/protocols'
import styles from '@/styles/wallet.module.css'
import CameraIcon from '@/svgs/camera-line.svg'
import BountyIcon from '@/svgs/bounty-bag.svg'
import AddIcon from '@/svgs/add-fill.svg'
import CloseIcon from '@/svgs/close-line.svg'
import ClipboardIcon from '@/svgs/clipboard-line.svg'
import EditIcon from '@/svgs/edit-line.svg'
import { CREATE_WITHDRAWL, SEND_TO_LNADDR } from '@/fragments/withdrawal'
import { numWithUnits } from '@/lib/format'
import { boolean, mixed, number, object, string } from '@/lib/yup'
import { useMutation } from '@apollo/client/react'
import { bech32 } from 'bech32'
import { bytesToHex } from '@noble/curves/abstract/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'
import { decode as decodeBolt11 } from 'light-bolt11-decoder'
import { useField, useFormikContext } from 'formik'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { InputGroup } from 'react-bootstrap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

const BOLT11_BECH32_LIMIT = 7089
const BOLT11_PREFIX = /^ln(?:bc|tb|bcrt|tbs)\d*[munp]?$/i
const DEFAULT_LNADDR_OPTIONS = { min: 1 }
const MAX_FEE = 10
const REWARD_SATS_ID = 'reward-sats'
const OPTIONAL_FIELDS = ['comment', 'name', 'email', 'identifier']

export default function WalletSendPage () {
  const router = useRouter()
  const wallets = useWallets()
  const routeId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
  const isRewardSats = routeId === REWARD_SATS_ID
  const wallet = useMemo(() => {
    const id = Number(routeId)
    if (!Number.isSafeInteger(id)) return null
    return wallets.find(wallet => Number(wallet.id) === id) ?? null
  }, [routeId, wallets])
  let content
  if (!router.isReady) {
    content = <WalletLoadingShell />
  } else if (isRewardSats) {
    content = <RewardSatsSend />
  } else if (!wallet) {
    content = <WalletErrorShell title='wallet not found' message='this wallet could not be found' />
  } else {
    content = <WalletSend wallet={wallet} />
  }

  return (
    <WalletRouteGateShell>
      {content}
    </WalletRouteGateShell>
  )
}

function WalletSend ({ wallet }) {
  const support = useWalletSupport(wallet)
  const status = useWalletStatus(wallet)
  const protocol = useMemo(() => {
    return wallet.protocols.find(protocol => protocol.send && protocol.enabled)
  }, [wallet.protocols])
  const { balance } = useWalletCardBalance(wallet)
  const subtitle = balance ? `${formatWalletBalance(balance)} available` : undefined
  const canSend = support.send && !['ERROR', 'DISABLED'].includes(status.send) && protocol
  if (!canSend) {
    return (
      <WalletActionShell wallet={wallet} title='send' subtitle={subtitle}>
        <div className='text-muted text-center'>
          This wallet cannot send right now. Check this wallet's configure page and logs.
        </div>
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell wallet={wallet} title='send' subtitle={subtitle}>
      <SendForm source='external' wallet={wallet} protocol={protocol} />
    </WalletActionShell>
  )
}

function RewardSatsSend () {
  const { me } = useMe()
  const availableSats = Math.max((me?.privates?.sats ?? 0) - (me?.privates?.credits ?? 0), 0)
  const identity = (
    <>
      <BountyIcon className={styles.internalWalletIcon} width={18} height={18} />
      <span className={styles.walletRowName}>reward sats</span>
    </>
  )

  if (availableSats <= 0) {
    return (
      <WalletActionShell title='send' identity={identity}>
        <div className={styles.walletActionSuccess}>
          <div>you have no reward sats to withdraw</div>
          <Link href='/wallets/reward-sats' className='btn btn-secondary'>
            back to wallet
          </Link>
        </div>
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell
      title='send'
      identity={identity}
      subtitle={`${numWithUnits(availableSats, { abbreviate: false, format: true, unitSingular: 'sat', unitPlural: 'sats' })} available`}
    >
      <SendForm source='reward-sats' availableSats={availableSats} />
    </WalletActionShell>
  )
}

function SendForm ({ source, wallet, protocol, availableSats }) {
  const { me } = useMe()
  const router = useRouter()
  const toaster = useToast()
  const [createWithdrawl] = useMutation(CREATE_WITHDRAWL)
  const [sendToLnAddr] = useMutation(SEND_TO_LNADDR)
  const [sent, setSent] = useState(false)
  const [destinationType, setDestinationType] = useState(null)
  const [checkingLnAddr, setCheckingLnAddr] = useState(false)
  const [addrOptions, setAddrOptions] = useState(DEFAULT_LNADDR_OPTIONS)
  const destinationRequestId = useRef(0)
  const rewardSats = source === 'reward-sats'
  const supportsMaxFee = rewardSats || protocol?.maxFee
  const showMaxFee = supportsMaxFee && ['bolt11', 'lnaddr'].includes(destinationType)
  const logger = useWalletLogger(protocol)

  const loadDestinationOptions = useCallback(async (value) => {
    const requestId = ++destinationRequestId.current
    const destination = normalizePaymentTarget(value)
    setCheckingLnAddr(false)
    if (!destination) {
      setDestinationType(null)
      setAddrOptions(DEFAULT_LNADDR_OPTIONS)
      return
    }

    if (isBolt11PaymentRequest(destination)) {
      setDestinationType('bolt11')
      setAddrOptions(DEFAULT_LNADDR_OPTIONS)
      return
    }

    if (isLightningAddress(destination)) {
      setDestinationType('lnaddr')
      setCheckingLnAddr(true)
      try {
        const options = await lnAddrOptions(destination)
        if (requestId === destinationRequestId.current) setAddrOptions(options)
      } catch (err) {
        console.log('failed to fetch lightning address options:', err)
        if (requestId === destinationRequestId.current) setAddrOptions(DEFAULT_LNADDR_OPTIONS)
      } finally {
        if (requestId === destinationRequestId.current) setCheckingLnAddr(false)
      }
      return
    }

    setDestinationType(null)
    setAddrOptions(DEFAULT_LNADDR_OPTIONS)
  }, [])

  const onDestinationChange = useDebounceCallback(async (formik, e) => {
    await loadDestinationOptions(e.target.value)
  }, 500, [loadDestinationOptions])

  const schema = useMemo(() => sendFormSchema({ rewardSats, supportsMaxFee, destinationType, addrOptions, availableSats }), [rewardSats, supportsMaxFee, destinationType, addrOptions, availableSats])

  if (sent && wallet) {
    return (
      <div className={styles.walletActionSuccess}>
        <div>payment sent</div>
        <Link href={`/wallets/${wallet.id}`} className='btn btn-secondary'>
          back to wallet
        </Link>
      </div>
    )
  }

  return (
    <Form
      initial={{
        destination: '',
        amount: 1,
        maxFee: MAX_FEE,
        comment: '',
        identifier: false,
        name: '',
        email: ''
      }}
      schema={schema}
      onSubmit={async ({ destination, ...values }) => {
        const target = normalizePaymentTarget(destination)
        if (isBolt11PaymentRequest(target)) {
          if (rewardSats) {
            const { data } = await createWithdrawl({ variables: { invoice: target.toLowerCase(), maxFee: Number(values.maxFee) } })
            router.push(`/transactions/${data.createWithdrawl.id}`)
            return
          }

          const bolt11 = target.toLowerCase()
          const msats = bolt11Msats(bolt11)
          const amountText = msats == null ? bolt11 : msatsAmountText(msats)
          try {
            logger.info(`↗ sending payment: ${amountText}`)
            await protocolSendPayment(protocol, bolt11, protocol.config, { ...sendOptions(values, supportsMaxFee), logger })
            logger.ok(`↗ payment sent: ${amountText}`, { updateStatus: true })
          } catch (err) {
            logger.error(`payment failed: ${err?.message ?? err?.toString?.() ?? 'unknown error'}`)
            throw err
          }
          toaster.success('payment sent')
          setSent(true)
          return
        }

        if (isLightningAddress(target)) {
          if (rewardSats) {
            const { data } = await sendToLnAddr({
              variables: {
                addr: target,
                amount: Number(values.amount),
                maxFee: Number(values.maxFee),
                ...lnAddrSubmitValues(values, addrOptions)
              }
            })
            router.push(`/transactions/${data.sendToLnAddr.id}`)
            return
          }

          const bolt11 = await fetchLightningAddressInvoice(target, values, addrOptions, me)
          const amountText = satsAmountText(values.amount) ?? target
          try {
            logger.info(`↗ sending payment: ${amountText}`)
            await protocolSendPayment(protocol, bolt11, protocol.config, { ...sendOptions(values, supportsMaxFee), logger })
            logger.ok(`↗ payment sent: ${amountText}`, { updateStatus: true })
          } catch (err) {
            logger.error(`payment failed: ${err?.message ?? err?.toString?.() ?? 'unknown error'}`)
            throw err
          }
          toaster.success('payment sent')
          setSent(true)
          return
        }

        throw new Error('enter a bolt11 invoice or lightning address')
      }}
    >
      <div className={styles.walletActionFields}>
        <DestinationInput
          checkingLnAddr={checkingLnAddr}
          destinationType={destinationType}
          onDestinationChange={onDestinationChange}
          loadDestinationOptions={loadDestinationOptions}
        />
        {destinationType === 'lnaddr'
          ? (
            <LightningAddressFields options={addrOptions} maxFee={showMaxFee && <MaxFeeField />} />
            )
          : (
            <>
              {destinationType === 'bolt11' && <InvoiceDetails />}
              {showMaxFee && <MaxFeeField />}
            </>
            )}
      </div>
      <div className={styles.walletActionFooter}>
        <Link href={source === 'reward-sats' ? '/wallets/reward-sats' : `/wallets/${wallet.id}`} className={styles.walletFooterBackButton}>
          back
        </Link>
        <WalletSendSubmitButton destinationType={destinationType} />
      </div>
    </Form>
  )
}

function WalletSendSubmitButton ({ destinationType }) {
  const { values } = useFormikContext()
  const appendText = sendAmountText(values, destinationType)

  return (
    <SubmitButton variant='primary' className={styles.walletActionSubmit} appendText={appendText}>
      send
    </SubmitButton>
  )
}

function DestinationInput ({ checkingLnAddr, onDestinationChange, loadDestinationOptions, destinationType }) {
  const innerRef = useRef(null)
  const blurTimeout = useRef()
  const [destinationFocused, setDestinationFocused] = useState(false)
  const [{ value },, helpers] = useField('destination')
  const resize = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    resize()
  }, [resize])

  useEffect(() => {
    return () => window.clearTimeout(blurTimeout.current)
  }, [])

  if (destinationType === 'bolt11' || (destinationType === 'lnaddr' && !destinationFocused)) {
    const destination = normalizePaymentTarget(value)
    return (
      <DetectedDestinationRow
        destination={destination}
        type={destinationType}
        checking={checkingLnAddr}
        onReplace={() => {
          helpers.setValue('')
          loadDestinationOptions('')
        }}
      />
    )
  }

  return (
    <Input
      label='invoice or lightning address'
      name='destination'
      as='textarea'
      rows={3}
      required
      autoFocus
      className={styles.walletDestinationInput}
      innerRef={innerRef}
      onFocus={() => {
        window.clearTimeout(blurTimeout.current)
        setDestinationFocused(true)
      }}
      onBlur={() => {
        blurTimeout.current = window.setTimeout(() => setDestinationFocused(false), 0)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        const destination = normalizePaymentTarget(e.currentTarget.value)
        if (!isLightningAddress(destination)) return
        e.preventDefault()
        loadDestinationOptions(destination)
        window.clearTimeout(blurTimeout.current)
        setDestinationFocused(false)
        e.currentTarget.blur()
      }}
      onChange={(formik, e) => {
        setDestinationFocused(true)
        window.requestAnimationFrame(resize)
        onDestinationChange(formik, e)
      }}
      under={
        <>
          <DestinationActions fieldName='destination' onValue={loadDestinationOptions} />
          <div className={styles.walletLnAddrPending} aria-live='polite'>
            {checkingLnAddr ? 'checking lightning address...' : '\u00a0'}
          </div>
        </>
      }
    />
  )
}

function DetectedDestinationRow ({ destination, type, checking, onReplace }) {
  const summary = destinationSummary(destination, type, checking)
  return (
    <div className={styles.walletDetectedInvoiceRow}>
      <div className={styles.walletDetectedInvoiceIdentity}>
        <div className={styles.walletDetectedInvoiceValue} title={destination}>
          {summary.title}
        </div>
        <div className={styles.walletRowMeta}>
          {summary.meta.map((item, index) => (
            <span key={item}>
              {index > 0 && <span className={styles.walletDetectedInvoiceDot}>·</span>}
              {item}
            </span>
          ))}
        </div>
      </div>
      <button type='button' className={styles.walletDetectedInvoiceReplace} onClick={onReplace}>
        replace
      </button>
    </div>
  )
}

function InvoiceDetails () {
  const [{ value }] = useField('destination')
  const [expanded, setExpanded] = useState(false)
  const details = useMemo(() => bolt11Details(normalizePaymentTarget(value)), [value])
  if (!details) return null
  const visibleChips = expanded ? details.chips : details.chips.slice(0, 3)
  const hiddenCount = details.chips.length - visibleChips.length

  return (
    <div className={styles.walletInvoiceDetails}>
      {details.amount && (
        <div className={styles.walletInvoiceAmount}>
          <span>{details.amount}</span>
          <span>{details.amountUnit}</span>
        </div>
      )}
      <div className={styles.walletInvoiceChipRow}>
        {visibleChips.map(chip => <InvoiceDetailChip key={chip.key} chip={chip} />)}
        {hiddenCount > 0 && (
          <button type='button' className={styles.walletInvoiceChip} onClick={() => setExpanded(true)}>
            + {hiddenCount} more
          </button>
        )}
        {expanded && details.chips.length > 3 && (
          <button type='button' className={styles.walletInvoiceChip} onClick={() => setExpanded(false)}>
            less
          </button>
        )}
      </div>
    </div>
  )
}

function InvoiceDetailChip ({ chip }) {
  return (
    <span className={`${styles.walletInvoiceChip} ${chip.tone === 'danger' ? styles.walletInvoiceChipDanger : ''}`}>
      {chip.label}
    </span>
  )
}

function LightningAddressFields ({ options, maxFee }) {
  const { me } = useMe()
  const { values, setFieldValue } = useFormikContext()
  const [activeFields, setActiveFields] = useState({})

  const mandatoryFields = useMemo(() => {
    return ['identifier', 'name', 'email'].filter(key => options.payerData?.[key]?.mandatory)
  }, [options.payerData])

  const optionalFields = useMemo(() => {
    return [
      options.commentAllowed ? 'comment' : null,
      ...['name', 'email', 'identifier'].map(key => options.payerData?.[key] && !options.payerData[key].mandatory ? key : null)
    ].filter(Boolean)
  }, [options.commentAllowed, options.payerData])

  const clearField = useCallback((name) => {
    setFieldValue(name, name === 'identifier' ? false : '')
  }, [setFieldValue])

  const toggleField = useCallback((name) => {
    if (name === 'identifier') {
      const enabled = !values.identifier
      setFieldValue('identifier', enabled)
      setActiveFields(fields => ({ ...fields, identifier: enabled }))
      return
    }

    if (activeFields[name]) clearField(name)
    setActiveFields(fields => ({ ...fields, [name]: !fields[name] }))
  }, [activeFields, clearField, setFieldValue, values.identifier])

  useEffect(() => {
    const supported = new Set([...mandatoryFields, ...optionalFields])
    for (const field of OPTIONAL_FIELDS) {
      if (!supported.has(field)) clearField(field)
    }
    setActiveFields(fields => Object.fromEntries(Object.entries(fields).filter(([field]) => supported.has(field))))
  }, [clearField, mandatoryFields, optionalFields])

  useEffect(() => {
    return () => {
      for (const field of OPTIONAL_FIELDS) clearField(field)
    }
  }, [clearField])

  return (
    <>
      <Input
        label='amount'
        name='amount'
        type='number'
        step={10}
        min={options.min}
        max={options.max}
        required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      {mandatoryFields.map(field => <LightningAddressField key={field} name={field} options={options} me={me} required />)}
      {maxFee}
      {optionalFields.length > 0 && (
        <div className={styles.fieldChipSection}>
          <div className={styles.fieldChipLabel}>optional</div>
          <div className={styles.fieldChipRow}>
            {optionalFields.map(field => (
              <FieldChip
                key={field}
                active={Boolean(field === 'identifier' ? values.identifier : activeFields[field])}
                label={chipLabel(field, me)}
                onClick={() => toggleField(field)}
              />
            ))}
          </div>
          {optionalFields.filter(field => field !== 'identifier' && activeFields[field]).map(field => (
            <LightningAddressField key={field} name={field} options={options} me={me} />
          ))}
        </div>
      )}
    </>
  )
}

function FieldChip ({ active, label, onClick }) {
  const Icon = active ? CloseIcon : AddIcon
  return (
    <button
      type='button'
      className={`${styles.fieldChip} ${active ? styles.fieldChipActive : ''}`}
      onClick={onClick}
    >
      <Icon className={styles.fieldChipIcon} width={14} height={14} aria-hidden />
      <span>{label}</span>
    </button>
  )
}

function LightningAddressField ({ name, options, me, required }) {
  const label = required ? <>{fieldLabel(name, me)} <small className='text-muted ms-2'>(required)</small></> : fieldLabel(name, me)

  if (name === 'comment') {
    return (
      <Input
        as='textarea'
        label={label}
        name='comment'
        maxLength={options.commentAllowed}
      />
    )
  }

  if (name === 'identifier') {
    return (
      <Checkbox
        name='identifier'
        required={required}
        label={label}
      />
    )
  }

  return (
    <Input
      name={name}
      required={required}
      label={label}
    />
  )
}

function fieldLabel (field, me) {
  if (field === 'identifier') return `your ${me?.name ?? 'stacker'}@stacker.news identifier`
  return field
}

function chipLabel (field, me) {
  if (field === 'identifier') return `include ${me?.name ?? 'me'}@stacker.news`
  return field
}

function DestinationActions ({ fieldName, onValue }) {
  const [,, helpers] = useField(fieldName)
  const [scanning, setScanning] = useState(false)
  const [scannerError, setScannerError] = useState(null)
  const toaster = useToast()
  const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(mod => mod.Scanner), {
    ssr: false,
    loading: () => null
  })

  const setDestinationValue = useCallback((rawValue, source) => {
    const value = normalizePaymentTarget(rawValue)
    if (!isBolt11PaymentRequest(value) && !isLightningAddress(value)) {
      toaster.danger(`${source}: not a bolt11 invoice or lightning address`)
      return false
    }
    helpers.setValue(value)
    onValue?.(value)
    return true
  }, [helpers, onValue, toaster])

  const pasteDestination = useCallback(async () => {
    try {
      const value = await navigator.clipboard?.readText()
      if (!value) {
        toaster.danger('paste: clipboard is empty')
        return
      }
      setDestinationValue(value, 'paste')
    } catch (err) {
      console.log(err)
      toaster.danger('paste: clipboard unavailable')
    }
  }, [setDestinationValue, toaster])

  return (
    <>
      <div className={styles.walletInvoiceActions}>
        <button
          type='button'
          className={styles.walletInvoiceScannerButton}
          onClick={() => {
            setScannerError(null)
            setScanning(true)
          }}
        >
          <CameraIcon height={18} width={18} />
          scan invoice
        </button>
        <button
          type='button'
          className={styles.walletInvoiceScannerButton}
          onClick={pasteDestination}
        >
          <ClipboardIcon height={18} width={18} />
          paste
        </button>
      </div>
      {scanning && (
        <div className={styles.walletInvoiceScannerOverlay}>
          <div className={styles.walletInvoiceScannerHeader}>
            <button
              type='button'
              className={`modal-btn modal-close ${styles.walletInvoiceScannerClose}`}
              onClick={() => setScanning(false)}
              aria-label='close scanner'
            >
              X
            </button>
          </div>
          <div className={styles.walletInvoiceScannerStage}>
            {scannerError
              ? <div className={styles.walletInvoiceScannerError}>{scannerError}</div>
              : (
                <>
                  <div className={styles.walletInvoiceScannerViewport}>
                    <Scanner
                      formats={['qr_code']}
                      components={{ finder: false }}
                      styles={{
                        container: { width: '100%', height: '100%', aspectRatio: '1 / 1' },
                        video: { width: '100%', height: '100%', objectFit: 'cover' }
                      }}
                      onScan={([{ rawValue }]) => {
                        if (setDestinationValue(rawValue, 'qr scan')) setScanning(false)
                      }}
                      onError={(error) => {
                        if (error instanceof DOMException) {
                          console.log(error)
                          setScannerError('camera unavailable. check browser permissions and try again.')
                        } else {
                          const message = error?.message || error?.toString?.() || 'unknown error'
                          toaster.danger(`qr scan: ${message}`)
                          setScannerError(`qr scan: ${message}`)
                        }
                      }}
                    />
                    <div className={styles.walletInvoiceScannerFrame} aria-hidden />
                  </div>
                  <div className={styles.walletInvoiceScannerHint}>Got a QR in your sights?</div>
                </>)}
          </div>
        </div>
      )}
    </>
  )
}

function MaxFeeField () {
  const [showMaxFee, setShowMaxFee] = useState(false)
  const [{ value }] = useField('maxFee')
  const ToggleIcon = showMaxFee ? CloseIcon : EditIcon

  return (
    <div className={styles.walletMaxFee}>
      <div className={styles.walletMaxFeeSummary}>
        <span className={styles.walletMaxFeeLabel}>max fee</span>
        <button
          type='button'
          className={styles.walletMaxFeeControl}
          onClick={() => setShowMaxFee(show => !show)}
          aria-expanded={showMaxFee}
        >
          <span className={styles.walletMaxFeeAmount}>{value}</span>
          <span className={styles.walletMaxFeeUnit}>sats</span>
          <ToggleIcon className={styles.walletMaxFeeIcon} width={18} height={18} aria-hidden />
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

function WalletActionShell ({ wallet, title, identity, subtitle, children }) {
  const available = availableBalanceParts(subtitle)
  return (
    <WalletShell noSidebar>
      <main className={styles.walletMain}>
        <div className={styles.walletActionPage}>
          <div className={styles.walletActionBody}>
            <div className={styles.walletActionHeading}>
              <h1>{title}</h1>
              <div className={styles.walletActionWalletRow}>
                <div className={styles.walletActionWallet}>
                  {identity ?? <WalletLayoutImageOrName name={wallet.name} maxHeight='18px' />}
                </div>
                {available && (
                  <div className={styles.walletActionAvailable}>
                    <div className={styles.walletActionAvailableAmount}>{available.amount}</div>
                    <div className={styles.walletActionAvailableLabel}>{available.label}</div>
                  </div>
                )}
              </div>
              {subtitle && !available && <div className={styles.walletActionSubtitle}>{subtitle}</div>}
            </div>
            {children}
          </div>
        </div>
      </main>
    </WalletShell>
  )
}

function availableBalanceParts (subtitle) {
  if (!subtitle?.endsWith(' available')) return null
  const value = subtitle.slice(0, -' available'.length)
  const parts = value.split(/\s+/)
  if (parts.length < 2) return { amount: value, label: 'available' }
  return {
    amount: parts.slice(0, -1).join(' '),
    label: `${parts.at(-1)} available`
  }
}

async function fetchLightningAddressInvoice (addr, values, options, me) {
  options = options?.callback ? options : await lnAddrOptions(addr)
  const amount = Number(values.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('amount must be positive')
  }
  if (options.min && amount < options.min) {
    throw new Error(`amount must be at least ${options.min} sats`)
  }
  if (options.max && amount > options.max) {
    throw new Error(`amount must be at most ${options.max} sats`)
  }
  if (options.commentAllowed && values.comment?.length > options.commentAllowed) {
    throw new Error(`comment must be at most ${options.commentAllowed} characters`)
  }

  const callback = new URL(options.callback)
  callback.searchParams.append('amount', amount * 1000)

  if (options.commentAllowed && values.comment?.length) {
    callback.searchParams.append('comment', values.comment)
  }

  const payer = payerData(values, options, me)
  if (Object.keys(payer).length > 0) {
    callback.searchParams.append('payerdata', JSON.stringify(payer))
  }

  const res = await fetch(callback.toString())
  const body = await res.json()
  if (body.status === 'ERROR') {
    throw new Error(body.reason ?? 'lightning address failed')
  }
  if (!isBolt11PaymentRequest(body.pr)) {
    throw new Error('lightning address did not return a bolt11 invoice')
  }
  return body.pr.toLowerCase()
}

function payerData (values, options, me) {
  const payer = {
    identifier: options.payerData?.identifier && values.identifier ? `${me.name}@stacker.news` : undefined,
    name: options.payerData?.name ? values.name : undefined,
    email: options.payerData?.email ? values.email : undefined
  }

  for (const key of ['identifier', 'name', 'email']) {
    if (options.payerData?.[key]?.mandatory && !payer[key]) {
      throw new Error(`${key} is required`)
    }
  }

  return Object.fromEntries(Object.entries(payer).filter(([, value]) => !!value))
}

function lnAddrSubmitValues (values, options) {
  return {
    ...(options.commentAllowed && values.comment?.length ? { comment: values.comment } : {}),
    ...(options.payerData?.identifier ? { identifier: Boolean(values.identifier) } : {}),
    ...(options.payerData?.name && values.name ? { name: values.name } : {}),
    ...(options.payerData?.email && values.email ? { email: values.email } : {})
  }
}

function sendOptions (values, supportsMaxFee) {
  return supportsMaxFee ? { maxFee: Number(values.maxFee) } : {}
}

function sendAmountText (values, destinationType) {
  if (destinationType === 'lnaddr') return satsAmountText(values.amount)
  if (destinationType === 'bolt11') {
    const msats = bolt11Msats(normalizePaymentTarget(values.destination))
    return msats == null ? undefined : msatsAmountText(msats)
  }
}

function satsAmountText (value) {
  const sats = Number(value)
  if (!Number.isFinite(sats) || sats <= 0) return undefined
  return numWithUnits(sats, { abbreviate: false, format: true, unitSingular: 'sat', unitPlural: 'sats' })
}

function msatsAmountText (msats) {
  const sats = msats / 1000n
  const remainder = msats % 1000n
  if (remainder === 0n && sats <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return satsAmountText(Number(sats))
  }
  if (remainder === 0n) {
    return `${sats.toString()} sats`
  }

  const value = `${sats.toString()}.${remainder.toString().padStart(3, '0').replace(/0+$/, '')}`
  return `${value} sats`
}

function sendFormSchema ({ rewardSats, supportsMaxFee, destinationType, addrOptions, availableSats }) {
  const amount = destinationType === 'lnaddr'
    ? number()
      .integer('must be an integer')
      .positive('must be positive')
      .min(addrOptions.min || 1, `must be at least ${addrOptions.min || 1}`)
      .test('lnaddr-max', `must be at most ${addrOptions.max}`, value => {
        if (!addrOptions.max || value == null) return true
        return value <= addrOptions.max
      })
      .test('reward-sats-balance', 'amount exceeds available reward sats', function (value) {
        if (!rewardSats || value == null) return true
        const maxFee = Number(this.parent.maxFee) || 0
        return value <= availableSats - maxFee
      })
    : mixed()

  return object({
    destination: string()
      .required('required')
      .test('bolt11-balance', 'invoice amount exceeds available reward sats', function (value) {
        if (!rewardSats) return true
        const target = normalizePaymentTarget(value)
        if (!isBolt11PaymentRequest(target)) return true
        const msats = bolt11Msats(target)
        return msats == null || msats <= BigInt(availableSats) * 1000n
      }),
    amount,
    maxFee: number()
      .integer('must be an integer')
      .min(0, 'must be at least 0')
      .test('required-for-max-fee', 'required', value => !supportsMaxFee || value != null),
    comment: addrOptions.commentAllowed
      ? string().max(addrOptions.commentAllowed, `must be at most ${addrOptions.commentAllowed} characters`)
      : string(),
    identifier: addrOptions.payerData?.identifier?.mandatory ? boolean().oneOf([true], 'required') : boolean(),
    name: addrOptions.payerData?.name?.mandatory ? string().required('required') : string(),
    email: (addrOptions.payerData?.email?.mandatory ? string().required('required') : string()).email('bad email address')
  })
}

function destinationSummary (destination, type, checking) {
  if (type === 'lnaddr') {
    return {
      title: destination,
      meta: [checking ? 'checking lightning address...' : 'lightning address']
    }
  }

  return invoiceDestinationSummary(destination)
}

function invoiceDestinationSummary (invoice) {
  try {
    const decoded = decodeBolt11(invoice)
    const description = bolt11Section(decoded, 'description')?.value
    return {
      title: description || truncateMiddle(invoice, 32),
      meta: ['bolt11 invoice']
    }
  } catch {
    return {
      title: truncateMiddle(invoice, 32),
      meta: ['bolt11 invoice']
    }
  }
}

function bolt11Msats (invoice) {
  try {
    const { prefix } = bech32.decode(invoice, BOLT11_BECH32_LIMIT)
    const match = prefix.match(/^ln(?:bc|tb|bcrt|tbs)(\d*)([munp]?)$/i)
    if (!match || !match[1]) return null
    const amount = BigInt(match[1])
    switch (match[2].toLowerCase()) {
      case 'm': return amount * 100_000_000n
      case 'u': return amount * 100_000n
      case 'n': return amount * 100n
      case 'p': return amount % 10n === 0n ? amount / 10n : null
      default: return amount * 100_000_000_000n
    }
  } catch {
    return null
  }
}

function bolt11Details (invoice) {
  if (!isBolt11PaymentRequest(invoice)) return null
  try {
    const decoded = decodeBolt11(invoice)
    const timestamp = bolt11Section(decoded, 'timestamp')?.value
    const expiry = bolt11Section(decoded, 'expiry')?.value
    const expiresAt = timestamp && expiry ? new Date((timestamp + expiry) * 1000) : null
    const createdAt = timestamp ? new Date(timestamp * 1000) : null
    const description = bolt11Section(decoded, 'description')?.value
    const network = bolt11Section(decoded, 'coin_network')?.letters
    const paymentHash = bolt11Section(decoded, 'payment_hash')?.value
    const payee = bolt11Section(decoded, 'payee')?.value ?? recoverPayeePubkey(invoice)
    const cltv = bolt11Section(decoded, 'min_final_cltv_expiry')?.value
    const routeHints = decoded.route_hints ?? []
    const features = invoiceFeatureLabels(bolt11Section(decoded, 'feature_bits')?.value)

    const chips = [
      description && { key: 'description', label: `for ${description}` },
      expiresAt && { key: 'expires-relative', label: invoiceRelativeExpiryLabel(expiresAt), tone: expiresAt <= new Date() ? 'danger' : undefined },
      payee && { key: 'payee', label: `to ${truncateMiddle(payee, 14)}` },
      createdAt && { key: 'created', label: `created ${relativeTime(createdAt)}` },
      expiresAt && { key: 'expires', label: `expires ${invoiceExpiryLabel(expiresAt)}` },
      network && { key: 'network', label: invoiceNetworkLabel(network) },
      cltv && { key: 'cltv', label: `min cltv ${cltv}` },
      ...routeHintChips(routeHints),
      ...features.map(feature => ({ key: `feature-${feature}`, label: feature })),
      paymentHash && { key: 'hash', label: `hash ${truncateMiddle(paymentHash, 12)}` }
    ].filter(Boolean)

    const amountMsats = bolt11Section(decoded, 'amount')?.value
    const amount = amountMsats ? msatsToDisplaySats(amountMsats) : null
    return {
      amount: amount?.amount,
      amountUnit: amount?.unit,
      chips
    }
  } catch {
    return null
  }
}

function bolt11Section (decoded, name) {
  return decoded.sections.find(section => section.name === name)
}

function recoverPayeePubkey (invoice) {
  const { prefix, words } = bech32.decode(invoice, BOLT11_BECH32_LIMIT)
  const signatureWords = words.slice(-104)
  const dataWords = words.slice(0, -104)
  const signatureBytes = bolt11WordsToBytes(signatureWords)
  const signature = signatureBytes.slice(0, -1)
  const recoveryFlag = signatureBytes[signatureBytes.length - 1]
  const message = new Uint8Array([
    ...new TextEncoder().encode(prefix),
    ...bolt11WordsToBytes(dataWords)
  ])
  const messageHash = sha256(message)
  const recovered = secp256k1.Signature
    .fromCompact(signature)
    .addRecoveryBit(recoveryFlag)
    .recoverPublicKey(messageHash)
    .toRawBytes(true)
  return bytesToHex(recovered)
}

function bolt11WordsToBytes (words) {
  let value = 0
  let bits = 0
  const result = []
  for (const word of words) {
    value = (value << 5) | word
    bits += 5
    while (bits >= 8) {
      bits -= 8
      result.push((value >> bits) & 0xff)
    }
  }
  if (bits > 0) result.push((value << (8 - bits)) & 0xff)
  return Uint8Array.from(result)
}

function msatsToDisplaySats (msats) {
  const sats = BigInt(msats) / 1000n
  const unit = sats === 1n ? 'sat' : 'sats'
  if (sats <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return {
      amount: new Intl.NumberFormat().format(Number(sats)),
      unit
    }
  }
  return {
    amount: sats.toString(),
    unit
  }
}

function invoiceExpiryLabel (expiresAt) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(expiresAt)
}

function invoiceRelativeExpiryLabel (expiresAt) {
  return expiresAt <= new Date() ? `expired ${relativeTime(expiresAt)}` : `expires ${relativeTime(expiresAt)}`
}

function relativeTime (date) {
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const suffix = diff < 0 ? 'ago' : ''
  const prefix = diff > 0 ? 'in ' : ''
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (abs < hour) return `${prefix}${Math.max(1, Math.round(abs / minute))}m${suffix ? ` ${suffix}` : ''}`
  if (abs < day) return `${prefix}${Math.round(abs / hour)}h${suffix ? ` ${suffix}` : ''}`
  return `${prefix}${Math.round(abs / day)}d${suffix ? ` ${suffix}` : ''}`
}

function invoiceNetworkLabel (network) {
  switch (network) {
    case 'bc': return 'mainnet'
    case 'tb': return 'testnet'
    case 'bcrt': return 'regtest'
    case 'tbs': return 'signet'
    default: return network
  }
}

function routeHintChips (routeHints) {
  return routeHints.flatMap((route, index) => {
    const firstHop = route[0]
    if (!firstHop) return []
    const routeLabel = `route hint ${index + 1}`
    const feeParts = [
      firstHop.fee_base_msat ? `${firstHop.fee_base_msat}msat base` : null,
      firstHop.fee_proportional_millionths ? `${firstHop.fee_proportional_millionths}ppm` : null
    ].filter(Boolean)
    const details = [
      feeParts.length > 0 ? feeParts.join(' + ') : null,
      firstHop.cltv_expiry_delta ? `cltv ${firstHop.cltv_expiry_delta}` : null
    ].filter(Boolean)
    return [
      { key: `route-${index}`, label: `${routeLabel} ${route.length} ${route.length === 1 ? 'hop' : 'hops'}` },
      { key: `route-hop-${index}`, label: `via ${truncateMiddle(firstHop.pubkey, 14)}` },
      details.length > 0 && { key: `route-fee-${index}`, label: details.join(', ') }
    ].filter(Boolean)
  })
}

function invoiceFeatureLabels (featureBits = {}) {
  const known = Object.entries(featureBits)
    .filter(([key, value]) => key !== 'word_length' && key !== 'extra_bits' && activeFeatureStatus(value))
    .map(([key, value]) => `${featureLabel(key)} ${activeFeatureStatus(value)}`)
  const unknownCount = featureBits.extra_bits?.bits?.filter(Boolean).length ?? 0
  if (featureBits.extra_bits?.has_required) return [...known, 'unknown required feature']
  if (unknownCount > 0) return [...known, `${unknownCount} unknown ${unknownCount === 1 ? 'feature bit' : 'feature bits'}`]
  return known
}

function activeFeatureStatus (value) {
  if (value === 'required' || value?.required) return 'required'
  if (value === 'supported' || value?.supported) return 'supported'
  return null
}

function featureLabel (feature) {
  switch (feature) {
    case 'option_data_loss_protect': return 'data loss protect'
    case 'initial_routing_sync': return 'initial routing sync'
    case 'option_upfront_shutdown_script': return 'upfront shutdown'
    case 'gossip_queries': return 'gossip queries'
    case 'var_onion_optin': return 'tlv onion'
    case 'gossip_queries_ex': return 'gossip queries ex'
    case 'option_static_remotekey': return 'static remote key'
    case 'payment_secret': return 'payment secret'
    case 'basic_mpp': return 'mpp'
    case 'option_support_large_channel': return 'large channel'
    default: return feature.replace(/^option_/, '').replaceAll('_', ' ')
  }
}

function truncateMiddle (value, maxLength) {
  if (value.length <= maxLength) return value
  const edge = Math.floor((maxLength - 1) / 2)
  return `${value.slice(0, edge)}…${value.slice(-edge)}`
}

function normalizePaymentTarget (value) {
  const raw = value?.trim() ?? ''
  const lower = raw.toLowerCase()
  if (lower.split('lightning=')[1]) {
    return lower.split('lightning=')[1].split(/[&?]/)[0]
  }
  if (lower.startsWith('lightning:')) {
    return raw.slice('lightning:'.length)
  }
  return raw
}

function isBolt11PaymentRequest (invoice) {
  try {
    const { prefix } = bech32.decode(invoice, BOLT11_BECH32_LIMIT)
    return BOLT11_PREFIX.test(prefix)
  } catch {
    return false
  }
}

function isLightningAddress (value) {
  return /^[^\s@]+@[^\s@]+$/.test(value)
}
