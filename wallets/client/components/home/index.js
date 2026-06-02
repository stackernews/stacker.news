import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Offcanvas } from 'react-bootstrap'
import classNames from 'classnames'
import { useSetWalletPriorities, useTemplates, useWallets, useWalletSendReady } from '@/wallets/client/hooks'
import { WalletShell } from '@/wallets/client/components'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import shellStyles from '@/wallets/client/components/layout.module.css'
import rowsStyles from './rows.module.css'
import sidebarStyles from './sidebar.module.css'
import CaretDown from '@/svgs/arrow-down-s-fill.svg'
import { walletRoute } from '@/wallets/lib/routes'
import { WalletList, WalletRow } from './list'
import { SelectedWalletPanel, WalletDetailsList } from './panel'
import { defaultWalletHomeRouteId, selectedWalletHomeEntry, walletHomeEntries } from './state'
const styles = { ...sharedStyles, ...shellStyles, ...rowsStyles, ...sidebarStyles }

export function WalletHome ({ routeWalletId }) {
  const wallets = useWallets()
  const templates = useTemplates()
  const walletSendReady = useWalletSendReady()
  const setWalletPriorities = useSetWalletPriorities()
  const router = useRouter()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [ordering, setOrdering] = useState(false)

  const entries = useMemo(() => walletHomeEntries(wallets), [wallets])
  const defaultRouteId = defaultWalletHomeRouteId(wallets)
  const selectedEntry = selectedWalletHomeEntry(entries, routeWalletId, defaultRouteId)

  useEffect(() => {
    if (!router.isReady || !walletSendReady || routeWalletId || !selectedEntry) return
    router.replace(walletRoute(selectedEntry), undefined, { shallow: true })
  }, [routeWalletId, router, selectedEntry, walletSendReady])

  const handleSelect = useCallback((routeId) => {
    setShowSwitcher(false)

    const entry = entries.find(entry => entry.routeId === routeId)
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

  const toggleOrdering = () => setOrdering(ordering => !ordering)

  return (
    <WalletShell
      mobileHeader={selectedEntry && (
        <WalletMobileHeader
          selectedEntry={selectedEntry}
          onShowSwitcher={() => setShowSwitcher(true)}
          onShowDetails={() => setShowDetails(true)}
        />
      )}
    >
      <aside className={classNames(styles.sidebar, 'd-flex flex-column gap-3')}>
        <h2 className={styles.title}>wallets</h2>
        <WalletList
          entries={entries}
          wallets={wallets}
          selectedRouteId={selectedEntry?.routeId}
          onSelect={handleSelect}
          ordering={ordering}
          onReorder={handleWalletReorder}
        />
        <WalletOrderingControls wallets={wallets} ordering={ordering} onToggle={toggleOrdering} />
      </aside>

      <main className={styles.walletMain}>
        <SelectedWalletPanel entry={selectedEntry} templates={templates} />
      </main>

      <WalletBottomSheet show={showSwitcher} onHide={() => setShowSwitcher(false)} title='switch wallet'>
        <WalletList
          entries={entries}
          wallets={wallets}
          selectedRouteId={selectedEntry?.routeId}
          onSelect={handleSelect}
          variant='mobileList'
          ordering={ordering}
          onReorder={handleWalletReorder}
        />
        <WalletOrderingControls wallets={wallets} ordering={ordering} onToggle={toggleOrdering} className='mt-3' hintClassName='mt-2' />
      </WalletBottomSheet>

      <WalletBottomSheet show={showDetails} onHide={() => setShowDetails(false)} title='details'>
        <WalletDetailsList entry={selectedEntry} onSelect={() => setShowDetails(false)} />
      </WalletBottomSheet>
    </WalletShell>
  )
}

function WalletMobileHeader ({ selectedEntry, onShowSwitcher, onShowDetails }) {
  if (selectedEntry.kind === 'add') return null

  return (
    <div className='d-flex flex-column gap-2'>
      <button className={classNames(styles.surfaceRow, styles.mobileWalletSelector, selectedEntry.kind === 'external' && styles.externalWalletRow)} onClick={onShowSwitcher}>
        <WalletRow entry={selectedEntry} />
        <CaretDown width={18} height={18} className={styles.mobileWalletCaret} />
      </button>
      <button className={classNames(styles.textButton, 'ms-auto')} onClick={onShowDetails}>details</button>
    </div>
  )
}

function WalletOrderingControls ({ wallets, ordering, onToggle, className, hintClassName }) {
  if (wallets.length <= 1) return null

  return (
    <>
      <button className={classNames(styles.textButton, className)} onClick={onToggle}>
        {ordering ? 'done ordering' : 'edit order'}
      </button>
      {ordering && <p className={classNames(styles.orderHint, hintClassName)}>drag external wallets to change wallet priority</p>}
    </>
  )
}

function WalletBottomSheet ({ show, onHide, title, children }) {
  return (
    <Offcanvas className={styles.sheet} show={show} onHide={onHide} placement='bottom'>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>{title}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {children}
      </Offcanvas.Body>
    </Offcanvas>
  )
}
