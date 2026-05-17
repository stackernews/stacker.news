import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  DndProvider,
  useSetWalletPriorities,
  useTemplates,
  useWalletImage,
  useWalletStatus,
  useWalletSupport,
  useWallets
} from '@/wallets/client/hooks'
import {
  formatWalletBalance,
  formatWalletBalanceLoading,
  Draggable,
  WalletShell,
  WalletRouteGateShell
} from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { urlify, walletDisplayName } from '@/wallets/lib/util'
import { useRouter } from 'next/router'
import Link from 'next/link'
import classNames from 'classnames'
import { Button, InputGroup, Offcanvas } from 'react-bootstrap'
import { useMe } from '@/components/me'
import { numWithUnits } from '@/lib/format'
import Plug from '@/svgs/plug.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import CaretDown from '@/svgs/arrow-down-s-fill.svg'
import CheckIcon from '@/svgs/check-line.svg'
import DragIcon from '@/svgs/draggable.svg'
import BountyIcon from '@/svgs/bounty-bag.svg'
import CowboyIcon from '@/svgs/cowboy.svg'
import { useShowModal } from '@/components/modal'
import { BUY_CREDITS } from '@/fragments/payIn'
import { useWalletCardBalance } from '@/wallets/client/components/card'
import { useAnimation } from '@/components/animation'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { Form, Input, SubmitButton } from '@/components/form'
import { amountSchema } from '@/lib/validate'
import { WalletSearch } from '@/wallets/client/components/search'
import PyramidButton from '@/components/pyramid-button'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

const REWARD_SATS_KEY = 'reward-sats'
const COWBOY_CREDITS_KEY = 'cowboy-credits'
const ADD_WALLET_KEY = 'add-wallet'
const EXTERNAL_PREFIX = 'wallet-'
const DETAIL_TABS = ['configure', 'logs', 'activity']

export default function Wallet () {
  return <WalletHome />
}

export function WalletHome ({ routeWalletId }) {
  const wallets = useWallets()
  const templates = useTemplates()
  const setWalletPriorities = useSetWalletPriorities()
  const router = useRouter()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [ordering, setOrdering] = useState(false)

  const entries = useMemo(() => [
    { kind: 'internal', key: REWARD_SATS_KEY, name: 'reward sats' },
    { kind: 'internal', key: COWBOY_CREDITS_KEY, name: 'cowboy credits' },
    ...wallets.map(wallet => ({ kind: 'external', key: walletKey(wallet), name: walletDisplayName(wallet.name), wallet })),
    { kind: 'add', key: ADD_WALLET_KEY, name: 'add wallet' }
  ], [wallets])

  const defaultKey = wallets[0] ? walletKey(wallets[0]) : REWARD_SATS_KEY
  const routeKey = routeSelectionKey(routeWalletId)
  const routeEntry = routeKey ? entries.find(entry => entry.key === routeKey) : null
  const selectedEntry = routeEntry ?? entries.find(entry => entry.key === defaultKey)

  useEffect(() => {
    if (!router.isReady || routeWalletId || !selectedEntry) return
    router.replace(walletRoute(selectedEntry), undefined, { shallow: true })
  }, [routeWalletId, router, selectedEntry])

  const handleSelect = useCallback((key, { navigate = true } = {}) => {
    setShowSwitcher(false)
    if (!navigate) return

    const entry = entries.find(entry => entry.key === key)
    if (!entry) return
    if (entry.kind === 'add') {
      router.push(walletRoute(entry))
    } else {
      router.replace(walletRoute(entry), undefined, { shallow: true })
    }
  }, [entries, router])

  const handleWalletReorder = useCallback(async (reorderedWallets) => {
    await setWalletPriorities(reorderedWallets)
  }, [setWalletPriorities])

  return (
    <WalletRouteGateShell>
      <WalletShell
        mobileHeader={selectedEntry && (
          <div className={styles.mobileWalletControls}>
            {selectedEntry.kind === 'add'
              ? null
              : (
                <>
                  <button className={classNames(styles.mobileWalletSelector, selectedEntry.kind === 'external' && styles.externalWalletRow)} onClick={() => setShowSwitcher(true)}>
                    <WalletEntryRow entry={selectedEntry} selected variant='mobileControl' />
                    <CaretDown width={18} height={18} className={styles.mobileWalletCaret} />
                  </button>
                  <button className={styles.detailsLink} onClick={() => setShowDetails(true)}>details</button>
                </>
                )}
          </div>
        )}
      >

        <aside className={styles.walletSidebar}>
          <h2 className={styles.sidebarTitle}>wallets</h2>
          <WalletEntryList entries={entries} wallets={wallets} selectedKey={selectedEntry?.key} onSelect={handleSelect} ordering={ordering} onReorder={handleWalletReorder} />
          {wallets.length > 1 && (
            <button className={styles.editOrderButton} onClick={() => setOrdering(ordering => !ordering)}>
              {ordering ? 'done ordering' : 'edit order'}
            </button>
          )}
          {ordering && <p className={styles.orderHint}>drag external wallets to change wallet priority</p>}
        </aside>

        <main className={styles.walletMain}>
          <SelectedWalletPanel
            entry={selectedEntry}
            templates={templates}
          />
        </main>

        <WalletBottomSheet show={showSwitcher} onHide={() => setShowSwitcher(false)} title='switch wallet'>
          <WalletEntryList entries={entries} wallets={wallets} selectedKey={selectedEntry?.key} onSelect={handleSelect} variant='mobileList' ordering={ordering} onReorder={handleWalletReorder} />
          {wallets.length > 1 && (
            <button
              className={classNames(styles.editOrderButton, 'mt-3')}
              onClick={() => {
                setOrdering(ordering => !ordering)
              }}
            >{ordering ? 'done ordering' : 'edit order'}
            </button>
          )}
          {ordering && <p className={classNames(styles.orderHint, styles.mobileOrderHint)}>drag external wallets to change wallet priority</p>}
        </WalletBottomSheet>

        <WalletBottomSheet show={showDetails} onHide={() => setShowDetails(false)} title='details'>
          <WalletDetailsList entry={selectedEntry} onSelect={() => setShowDetails(false)} />
        </WalletBottomSheet>
      </WalletShell>
    </WalletRouteGateShell>
  )
}

function walletKey (wallet) {
  return `${EXTERNAL_PREFIX}${wallet.id}`
}

function routeSelectionKey (routeWalletId) {
  if (!routeWalletId) return null
  if (routeWalletId === 'add') return ADD_WALLET_KEY
  if ([REWARD_SATS_KEY, COWBOY_CREDITS_KEY, ADD_WALLET_KEY].includes(routeWalletId)) return routeWalletId
  return `${EXTERNAL_PREFIX}${routeWalletId}`
}

function walletRoute (entry) {
  if (entry.kind === 'external') return `/wallets/${entry.wallet.id}`
  if (entry.key === ADD_WALLET_KEY) return '/wallets/add'
  return `/wallets/${entry.key}`
}

function WalletBottomSheet ({ show, onHide, title, children }) {
  return (
    <Offcanvas className={styles.walletSheet} show={show} onHide={onHide} placement='bottom'>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>{title}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {children}
      </Offcanvas.Body>
    </Offcanvas>
  )
}

function WalletEntryList ({ entries, wallets, selectedKey, onSelect, variant, ordering, onReorder }) {
  const mobile = variant === 'mobileList'

  const list = (
    <div className={classNames(styles.walletList, mobile && styles.mobileWalletList)}>
      {entries.map((entry, index) => {
        const sectionLabel = walletEntrySectionLabel(entry)
        const previousSectionLabel = walletEntrySectionLabel(entries[index - 1])
        const showSectionLabel = sectionLabel && sectionLabel !== previousSectionLabel
        const externalIndex = entry.kind === 'external'
          ? wallets.findIndex(wallet => Number(wallet.id) === Number(entry.wallet.id))
          : -1
        const rowClassName = classNames(
          mobile ? styles.mobileWalletRow : styles.walletRow,
          entry.kind === 'external' && styles.externalWalletRow,
          entry.kind === 'add' && styles.addWalletRow,
          ordering && entry.kind === 'external' && styles.orderingWalletRow,
          entry.key === selectedKey && (mobile ? styles.selectedMobileWalletRow : styles.selectedWalletRow)
        )
        const rowContent = (
          <>
            {ordering && entry.kind === 'external' && <DragIcon className={styles.orderDragIcon} />}
            <WalletEntryRow entry={entry} selected={entry.key === selectedKey} variant={variant} />
          </>
        )
        const row = entry.kind === 'add'
          ? (
            <Link
              href={walletRoute(entry)}
              className={rowClassName}
              onClick={(event) => {
                if (ordering) {
                  event.preventDefault()
                  return
                }
                event.preventDefault()
                onSelect(entry.key)
              }}
            >
              {rowContent}
            </Link>
            )
          : (
            <button
              type='button'
              className={rowClassName}
              onClick={() => {
                if (!ordering) onSelect(entry.key)
              }}
            >
              {rowContent}
            </button>
            )

        return (
          <Fragment key={entry.key}>
            {showSectionLabel && <div className={styles.walletSectionLabel}>{sectionLabel}</div>}
            {ordering && entry.kind === 'external'
              ? <Draggable index={externalIndex}>{row}</Draggable>
              : row}
          </Fragment>
        )
      })}
    </div>
  )

  if (!ordering) return list

  return (
    <DndProvider items={wallets} onReorder={onReorder}>
      {list}
    </DndProvider>
  )
}

function walletEntrySectionLabel (entry) {
  if (!entry) return null
  if (entry.kind === 'internal') return 'stacker news'
  if (entry.kind === 'external') return 'connected'
  return null
}

function WalletEntryRow ({ entry, selected, variant }) {
  if (entry.kind === 'add') {
    return <div className={styles.addWalletLabel}>{entry.name}</div>
  }

  if (entry.kind === 'external') {
    return (
      <>
        <div className={styles.walletRowIdentity}>
          <div className={styles.walletRowLogoLine}>
            <WalletEntryIcon entry={entry} />
          </div>
          <ExternalWalletStatus wallet={entry.wallet} />
        </div>
        <ExternalWalletRowBalance wallet={entry.wallet} />
        {variant === 'mobileList' && selected && <CheckIcon width={18} height={18} className={styles.mobileWalletSelectedIcon} />}
      </>
    )
  }

  return (
    <>
      <div className={styles.walletRowIdentity}>
        <div className={styles.walletRowLogoLine}>
          <WalletEntryIcon entry={entry} />
          <div className={styles.walletRowName}>{entry.name}</div>
        </div>
      </div>
      <InternalWalletRowBalance entry={entry} />
      {variant === 'mobileList' && selected && entry.kind !== 'add' && <CheckIcon width={18} height={18} className={styles.mobileWalletSelectedIcon} />}
    </>
  )
}

function InternalWalletRowBalance ({ entry }) {
  if (entry.kind !== 'internal') return <div className={styles.walletRowBalance} />
  const { amount, units } = useInternalWalletBalance(entry)
  const rowUnits = entry.key === COWBOY_CREDITS_KEY
    ? { unitSingular: 'CC', unitPlural: 'CCs' }
    : units

  return (
    <div className={styles.walletRowBalance}>
      {numWithUnits(amount, { abbreviate: true, format: true, ...rowUnits })}
    </div>
  )
}

function ExternalWalletRowBalance ({ wallet }) {
  const { balance, loading, unavailable, error, showBalanceSlot } = useWalletCardBalance(wallet)
  let content = null

  if (showBalanceSlot) {
    if (balance) {
      content = formatWalletBalance(balance)
    } else if (loading) {
      content = <span className={styles.walletRowBalanceLoading}>{formatWalletBalanceLoading()}</span>
    } else if (error) {
      content = (
        <span
          className={classNames(styles.walletRowBalanceError, error === 'permanent' && styles.walletRowBalanceErrorPermanent)}
          title={error === 'permanent' ? 'balance access denied' : 'balance temporarily unavailable'}
        >!
        </span>
      )
    } else if (unavailable) {
      content = <span className={styles.walletRowBalanceUnavailable}>—</span>
    }
  }

  return (
    <div className={styles.walletRowBalance} aria-hidden={!showBalanceSlot}>
      {content}
    </div>
  )
}

function WalletEntryIcon ({ entry }) {
  if (entry.kind === 'external') return <ExternalWalletIcon name={entry.wallet.name} />
  if (entry.key === COWBOY_CREDITS_KEY) return <CowboyIcon className={styles.internalWalletIcon} width={28} height={28} />
  if (entry.key === ADD_WALLET_KEY) return <Plug className={styles.internalWalletIcon} width={24} height={24} />
  return <BountyIcon className={styles.internalWalletIcon} width={28} height={28} />
}

function ExternalWalletIcon ({ name }) {
  const image = useWalletImage(name)
  if (image) return <img className={styles.walletRowLogo} {...image} />
  return <div className={styles.walletRowFallback}>{walletDisplayName(name).slice(0, 1)}</div>
}

function ExternalWalletStatus ({ wallet }) {
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)

  return (
    <span className={styles.walletRowMeta}>
      {support.receive && <StatusIcon icon={RecvIcon} status={status.receive} label='receive' />}
      {support.send && <StatusIcon icon={SendIcon} status={status.send} label='send' />}
    </span>
  )
}

function StatusIcon ({ icon: Icon, status, label, iconOnly }) {
  return (
    <span className={classNames(styles.statusPill, statusClass(status))} title={`${label}: ${status.toLowerCase()}`} aria-label={`${label}: ${status.toLowerCase()}`}>
      <Icon className={styles.statusIcon} />
      {!iconOnly && <span className={styles.statusDivider} aria-hidden />}
      <span className={classNames(styles.statusLabel, iconOnly && 'visually-hidden')}>{label}</span>
    </span>
  )
}

function statusClass (status) {
  switch (status) {
    case 'OK': return styles.success
    case 'ERROR': return styles.error
    case 'WARNING': return styles.warning
    case 'DISABLED': return styles.disabled
    case 'SUPPORTED': return styles.supported
  }
}

function SelectedWalletPanel ({ entry, templates }) {
  if (!entry) return null
  if (entry.kind === 'add') return <AddWalletPanel templates={templates} />

  return (
    <div className={styles.selectedWalletPanel}>
      <div className={styles.selectedWalletHeader}>
        <SelectedWalletIdentity entry={entry} />
        {entry.kind === 'external' && <WalletDetailRouteNav wallet={entry.wallet} />}
      </div>
      {entry.kind === 'external' ? <ExternalWalletBalance wallet={entry.wallet} /> : <InternalWalletBalance entry={entry} />}
      <WalletActions entry={entry} />
    </div>
  )
}

function SelectedWalletIdentity ({ entry }) {
  return (
    <div className={styles.selectedWalletIdentity}>
      <WalletEntryIcon entry={entry} />
      {entry.kind !== 'external' && <span>{entry.name}</span>}
    </div>
  )
}

function WalletDetailRouteNav ({ wallet }) {
  return (
    <nav className={styles.desktopWalletNav}>
      {DETAIL_TABS.map(tab => (
        <Link key={tab} href={walletDetailHref(wallet, tab)} className={styles.walletTab}>{tab}</Link>
      ))}
    </nav>
  )
}

function walletDetailHref (wallet, tab) {
  return `/wallets/${wallet.id}/${tab}`
}

function ExternalWalletBalance ({ wallet }) {
  const { balance, loading, error } = useWalletCardBalance(wallet)
  if (balance) {
    return (
      <div className={styles.bigBalance}>
        <BigBalanceAmount>
          {balance.currency === 'BTC'
            ? new Intl.NumberFormat().format(balance.amount)
            : new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: balance.currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(balance.amount / 100)}
        </BigBalanceAmount>
        <span className={styles.bigBalanceUnit}>
          {balance.currency === 'BTC' ? (balance.amount === 1 ? 'sat' : 'sats') : balance.currency}
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={classNames(styles.bigBalance, styles.bigBalanceLoading)} aria-live='polite'>
        <BigBalanceAmount>
          {formatWalletBalanceLoading()}
        </BigBalanceAmount>
        <span className={styles.bigBalanceUnit}>sats</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.bigBalanceUnavailable}>
        <div className={styles.bigBalanceUnavailableDash}>—</div>
        <div className={styles.bigBalanceUnavailableMessage}>
          {error === 'permanent' ? 'balance access denied' : 'balance temporarily unavailable'}
        </div>
        <div className={styles.bigBalanceErrorMessageSecondary}>
          {error === 'permanent' ? "check this wallet's permissions on the configure page" : 'check your connection and try again'}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.bigBalanceUnavailable}>
      <div className={styles.bigBalanceUnavailableDash}>—</div>
      <div className={styles.bigBalanceUnavailableMessage}>
        balance not exposed by this connection
      </div>
    </div>
  )
}

function InternalWalletBalance ({ entry }) {
  const { amount, units } = useInternalWalletBalance(entry)

  return (
    <div className={styles.bigBalance}>
      <BigBalanceAmount>
        {new Intl.NumberFormat().format(amount)}
      </BigBalanceAmount>
      <span className={styles.bigBalanceUnit}>
        {amount === 1 ? units.unitSingular : units.unitPlural}
      </span>
    </div>
  )
}

function BigBalanceAmount ({ children }) {
  const length = String(children).length

  return (
    <span className={styles.bigBalanceAmount} style={{ '--balance-chars': length }}>
      {children}
    </span>
  )
}

function useInternalWalletBalance (entry) {
  const { me } = useMe()
  const amount = entry.key === REWARD_SATS_KEY
    ? (me?.privates?.sats ?? 0) - (me?.privates?.credits ?? 0)
    : me?.privates?.credits ?? 0
  const units = entry.key === REWARD_SATS_KEY
    ? { unitSingular: 'sat', unitPlural: 'sats' }
    : { unitSingular: 'cowboy credit', unitPlural: 'cowboy credits' }

  return { amount, units }
}

function WalletActions ({ entry }) {
  if (entry.kind === 'internal') {
    if (entry.key === COWBOY_CREDITS_KEY) {
      return (
        <div className={styles.walletActions}>
          <BuyCreditsAction />
        </div>
      )
    }

    return (
      <div className={styles.walletActions}>
        <WalletPyramidAction href='/wallets/reward-sats/send' label='send' tone='send' singleAction />
      </div>
    )
  }

  return <ExternalWalletActions wallet={entry.wallet} />
}

function ExternalWalletActions ({ wallet }) {
  const status = useWalletStatus(wallet)
  const hasConfiguredProtocols = wallet.protocols.length > 0
  const receiveProtocol = useMemo(() => {
    return wallet.protocols.find(protocol => !protocol.send && protocol.enabled)
  }, [wallet.protocols])
  const sendProtocol = useMemo(() => {
    return wallet.protocols.find(protocol => protocol.send && protocol.enabled)
  }, [wallet.protocols])
  const canReceive = receiveProtocol && !['ERROR', 'DISABLED'].includes(status.receive)
  const canSend = sendProtocol && !['ERROR', 'DISABLED'].includes(status.send)
  const actionCount = Number(Boolean(receiveProtocol)) + Number(Boolean(sendProtocol))
  const singleAction = actionCount === 1
  const hasEnabledProtocol = Boolean(receiveProtocol || sendProtocol)

  if (!hasEnabledProtocol && hasConfiguredProtocols) {
    return (
      <div className={classNames(styles.walletActions, styles.walletActionsCompact)}>
        <Button as={Link} href={`/wallets/${wallet.id}/configure`} variant='outline-secondary' size='sm'>configure</Button>
      </div>
    )
  }

  return (
    <div className={styles.walletActions}>
      {receiveProtocol && <ExternalWalletReceiveAction wallet={wallet} disabled={!canReceive} singleAction={singleAction} />}
      {sendProtocol && <ExternalWalletSendAction wallet={wallet} disabled={!canSend} singleAction={singleAction} />}
      {!receiveProtocol && !sendProtocol && <Button as={Link} href={`/wallets/${wallet.id}/configure`} variant='outline-secondary' className={styles.walletActionButton}>configure</Button>}
    </div>
  )
}

function ExternalWalletReceiveAction ({ wallet, disabled, singleAction }) {
  return (
    <WalletPyramidAction href={`/wallets/${wallet.id}/receive`} label='RECV' ariaLabel='receive' tone='receive' disabled={disabled} singleAction={singleAction} />
  )
}

function ExternalWalletSendAction ({ wallet, disabled, singleAction }) {
  return (
    <WalletPyramidAction href={`/wallets/${wallet.id}/send`} label='send' tone='send' disabled={disabled} singleAction={singleAction} />
  )
}

function WalletPyramidAction ({ href, label, ariaLabel, tone, disabled, singleAction, onClick }) {
  const router = useRouter()
  const palette = {
    buy: { hue: 0, chroma: 0, direction: 'in' },
    receive: { hue: 0, chroma: 0, direction: 'in' },
    send: { hue: 0, chroma: 0, direction: 'out' }
  }[tone] ?? { hue: 32, chroma: 0.08, direction: 'in' }

  return (
    <PyramidButton
      className={styles.walletActionButton}
      label={label}
      ariaLabel={ariaLabel ?? label}
      aspect={2.8}
      layers={singleAction ? 5 : 3}
      innerWidthScale={singleAction ? 1.55 : 1}
      radius={8}
      depth={1}
      fontSize={singleAction ? 20 : 14}
      pad={18}
      hue={palette.hue}
      chroma={palette.chroma}
      direction={palette.direction}
      disabled={disabled}
      onClick={() => {
        if (href) return router.push(href)
        onClick?.()
      }}
    />
  )
}

function WalletDetailsList ({ entry, onSelect }) {
  if (!entry || entry.kind === 'add') return null

  const items = entry.kind === 'external'
    ? DETAIL_TABS.map(tab => ({ key: tab, href: walletDetailHref(entry.wallet, tab), label: tab }))
    : [{ key: 'settings', href: '/settings/wallets', label: 'settings' }]

  return (
    <div className={styles.walletDetailsList}>
      {items.map(item => (
        <Link key={item.key} href={item.href} className={styles.walletDetailsListItem} onClick={onSelect}>
          {item.label}
        </Link>
      ))}
    </div>
  )
}

function BuyCreditsAction () {
  const showModal = useShowModal()
  const animate = useAnimation()
  const [buyCredits] = usePayInMutation(BUY_CREDITS)

  return (
    <WalletPyramidAction
      label='buy'
      tone='buy'
      singleAction
      onClick={() => showModal(onClose => (
        <Form
          initial={{ amount: 10000 }}
          schema={amountSchema}
          onSubmit={async ({ amount }) => {
            const { error } = await buyCredits({
              variables: {
                credits: Number(amount)
              },
              onCompleted: () => {
                animate()
              }
            })
            onClose()
            if (error) throw error
          }}
        >
          <Input
            label='amount'
            name='amount'
            type='number'
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <div className='d-flex'>
            <SubmitButton variant='secondary' className='ms-auto mt-1 px-4'>buy</SubmitButton>
          </div>
        </Form>
      ))}
    />
  )
}

function AddWalletPanel ({ templates }) {
  const [searchFilter, setSearchFilter] = useState(() => (text) => true)
  const filteredTemplates = useMemo(() => {
    return templates.filter(({ name }) => searchFilter(walletDisplayName(name)) || searchFilter(name))
  }, [searchFilter, templates])

  return (
    <div className={styles.addWalletPanel}>
      <h2>add wallet</h2>
      <p className='text-muted'>Choose a wallet to connect.</p>
      <WalletSearch setSearchFilter={setSearchFilter} />
      <div className={styles.templateList}>
        {filteredTemplates.map(template => (
          <Link key={template.name} href={`/wallets/${urlify(template.name)}/configure`} className={styles.templateRow}>
            <AddWalletTemplateLabel template={template} />
            <TemplateWalletSupport template={template} />
          </Link>
        ))}
        {filteredTemplates.length === 0 && (
          <div className={styles.emptyState}>
            no wallets found
          </div>
        )}
      </div>
    </div>
  )
}

function AddWalletTemplateLabel ({ template }) {
  const [imageError, setImageError] = useState(false)
  const { name } = template
  const image = useWalletImage(name)
  if (!image || imageError) return <span className={styles.templateFallbackName}>{walletDisplayName(name)}</span>

  return (
    <img className={styles.templateLogo} onError={() => setImageError(true)} {...image} />
  )
}

function TemplateWalletSupport ({ template }) {
  const support = useWalletSupport(template)

  return (
    <span className={styles.templateSupport}>
      {support.receive && <StatusIcon icon={RecvIcon} status='SUPPORTED' label='receive' />}
      {support.send && <StatusIcon icon={SendIcon} status='SUPPORTED' label='send' />}
    </span>
  )
}
