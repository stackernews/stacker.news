import { Card } from 'react-bootstrap'
import classNames from 'classnames'
import styles from '@/styles/wallet.module.css'
import Plug from '@/svgs/plug.svg'
import Gear from '@/svgs/settings-5-fill.svg'
import Link from 'next/link'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import DragIcon from '@/svgs/draggable.svg'
import { useWalletImage, useWalletSupport, useWalletStatus, WalletStatus, useWalletDelete } from '@/wallets/client/hooks'
import protocols from '@/wallets/client/protocols'
import { numWithUnits } from '@/lib/format'
import { isWallet, urlify, walletDisplayName } from '@/wallets/lib/util'
import { Draggable } from '@/wallets/client/components'
import TrashIcon from '@/svgs/delete-bin-line.svg'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { FetchTimeoutError } from '@/lib/fetch'
import { WalletPermissionsError, WalletValidationError } from '@/wallets/client/errors'

const walletBalanceCache = new Map()

function walletBalanceCacheKey (wallet, protocol) {
  return `${wallet.id}:${protocol.name}:${protocol.id ?? protocol.config?.id ?? protocol.config?.url ?? protocol.config?.address ?? 'default'}`
}

function classifyWalletBalanceError (err) {
  if (err instanceof WalletPermissionsError || err instanceof WalletValidationError) {
    return 'permanent'
  }

  if ([401, 403, 404].includes(err?.status)) {
    return 'permanent'
  }

  const message = err?.message?.toLowerCase?.() ?? ''
  if (/(unauthorized|forbidden|permission|missing .* scope|invalid .* (key|token|credential)|wallet .* not found)/.test(message)) {
    return 'permanent'
  }

  if (err instanceof FetchTimeoutError || err?.name === 'TypeError') {
    return 'temporary'
  }

  if (err?.status >= 500 || [408, 429].includes(err?.status)) {
    return 'temporary'
  }

  return 'temporary'
}

export function WalletCard ({ wallet, draggable = false, index, ...props }) {
  const image = useWalletImage(wallet.name)
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)
  const { balance, loading, unavailable, error, showBalanceSlot } = useWalletCardBalance(wallet)
  const showModal = useShowModal()
  const router = useRouter()

  const card = (
    <Card
      className={styles.card}
      {...props}
    >
      <div className={styles.indicators}>
        {draggable && <DragIcon className={classNames(styles.indicator, styles.drag, 'me-auto')} />}
        {support.send && <SendIcon className={`${styles.indicator} ${statusToClass(status.send)}`} />}
        {support.receive && <RecvIcon className={`${styles.indicator} ${statusToClass(status.receive)}`} />}
      </div>
      <Card.Body>
        <div className={classNames(
          'd-flex flex-column text-center align-items-center justify-content-center h-100',
          showBalanceSlot && styles.walletBodyWithBalance
        )}
        >
          {image
            ? <img className={styles.walletLogo} {...image} />
            : <Card.Title className={styles.walletLogo}>{walletDisplayName(wallet.name)}</Card.Title>}
          {showBalanceSlot && (
            <div className={styles.walletBalance}>
              <WalletCardBalance balance={balance} loading={loading} unavailable={unavailable} error={error} />
            </div>
          )}
        </div>
      </Card.Body>
      <Card.Footer className={classNames(styles.attach, 'd-flex justify-content-around px-2 px-sm-3')}>
        {isWallet(wallet)
          ? (
            <>
              <WalletLink wallet={wallet} className='pe-1 pe-sm-2 justify-content-center d-flex align-items-center text-reset'>
                <Gear width={14} height={14} className='me-2' />modify
              </WalletLink>
              <div className='pointer text-center border-start ps-2 ps-sm-3 d-flex align-items-center' onClick={() => showModal(onClose => <WalletDeleteObstacle wallet={wallet} onClose={onClose} onSuccess={() => router.push('/wallets')} />)}><TrashIcon width={18} height={18} /></div>
            </>
            )
          : (
            <WalletLink wallet={wallet} className='justify-content-center d-flex align-items-center text-reset'>
              <Plug width={14} height={14} className='me-2' />attach
            </WalletLink>)}
      </Card.Footer>
    </Card>
  )

  if (draggable) {
    return (
      <Draggable index={index}>
        {card}
      </Draggable>
    )
  }

  return card
}

function WalletCardBalance ({ balance, loading, unavailable, error }) {
  if (balance !== null) return formatWalletBalance(balance)
  if (loading) return <span className={styles.walletRowBalanceLoading}>{formatWalletBalanceLoading()}</span>
  if (error) {
    return (
      <span
        className={classNames(styles.walletRowBalanceError, error === 'permanent' && styles.walletRowBalanceErrorPermanent)}
        title={error === 'permanent' ? 'balance access denied' : 'balance temporarily unavailable'}
      >!
      </span>
    )
  }
  if (unavailable) return <span className={styles.walletRowBalanceUnavailable}>—</span>
  return null
}

function WalletLink ({ wallet, children, className }) {
  const href = '/wallets' + (isWallet(wallet) ? `/${wallet.id}/configure` : `/${urlify(wallet.name)}/configure`)
  return <Link href={href} className={className}>{children}</Link>
}

function statusToClass (status) {
  switch (status) {
    case WalletStatus.OK: return styles.success
    case WalletStatus.ERROR: return styles.error
    case WalletStatus.WARNING: return styles.warning
    case WalletStatus.DISABLED: return styles.disabled
  }
}

export function useWalletCardBalance (wallet) {
  const sendProtocol = useMemo(() => {
    if (!isWallet(wallet)) return null

    const configuredSendProtocols = wallet.protocols.filter(protocol => protocol.send && protocol.enabled)
    if (configuredSendProtocols.length === 0) return null

    const configuredByName = new Map(configuredSendProtocols.map(protocol => [protocol.name, protocol]))
    const templateOrderedProtocols = (wallet.template?.protocols || [])
      .filter(protocol => protocol.send)
      .map(protocol => configuredByName.get(protocol.name))
      .filter(Boolean)
    const remainingProtocols = configuredSendProtocols
      .filter(protocol => !templateOrderedProtocols.some(ordered => ordered.id === protocol.id))
    const configuredProtocol = [...templateOrderedProtocols, ...remainingProtocols][0]
    if (!configuredProtocol) return null

    const walletProtocol = protocols.find(protocol => protocol.name === configuredProtocol.name)
    if (!walletProtocol?.getBalance) return null

    return {
      id: configuredProtocol.id,
      name: configuredProtocol.name,
      config: configuredProtocol.config,
      getBalance: walletProtocol.getBalance
    }
  }, [wallet])
  const cacheKey = sendProtocol ? walletBalanceCacheKey(wallet, sendProtocol) : null
  const [balance, setBalance] = useState(() => cacheKey ? walletBalanceCache.get(cacheKey) ?? null : null)
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sendProtocol) {
      setBalance(null)
      setLoading(false)
      setUnavailable(true)
      setError(null)
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const cachedBalance = walletBalanceCache.get(cacheKey)

    setBalance(cachedBalance ?? null)
    setLoading(cachedBalance === undefined)
    setUnavailable(false)
    setError(null)
    sendProtocol.getBalance(sendProtocol.config, { signal: controller.signal })
      .then(nextBalance => {
        if (cancelled) return
        if (nextBalance !== null && nextBalance !== undefined) {
          walletBalanceCache.set(cacheKey, nextBalance)
          setBalance(nextBalance)
          setUnavailable(false)
          setError(null)
        } else {
          setBalance(cachedBalance ?? null)
          setUnavailable(cachedBalance === undefined)
          setError(null)
        }
        setLoading(false)
      })
      .catch(err => {
        if (cancelled || err?.name === 'AbortError') return
        console.error('failed to fetch wallet balance:', err)
        setLoading(false)
        if (cachedBalance === undefined) {
          setUnavailable(false)
          setError(classifyWalletBalanceError(err))
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [sendProtocol, cacheKey])

  return {
    balance,
    loading,
    unavailable,
    error,
    showBalanceSlot: isWallet(wallet)
  }
}

export function formatWalletBalanceLoading () {
  try {
    const group = new Intl.NumberFormat(undefined)
      .formatToParts(1000)
      .find(part => part.type === 'group')?.value ?? ','
    return ['L', 'OAD', 'ING'].join(group)
  } catch {
    return 'L,OAD,ING'
  }
}

export function formatWalletBalance ({ amount, currency }) {
  if (currency === 'BTC') {
    return numWithUnits(amount)
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount / 100)
}

export function WalletDeleteObstacle ({ wallet, onClose, onSuccess }) {
  const deleteWallet = useWalletDelete(wallet)
  const toaster = useToast()

  const handleConfirm = async () => {
    try {
      await deleteWallet()
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('failed to delete wallet:', err)
      toaster.danger('failed to delete wallet')
    }
  }

  return (
    <div className='text-center'>
      <h4 className='mb-3'>Delete wallet</h4>
      <p className='fw-bold'>
        Are you sure you want to delete this wallet?
      </p>
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='delete' />
    </div>
  )
}
