import { Fragment } from 'react'
import classNames from 'classnames'
import { Draggable } from '../dnd'
import { DndProvider, walletStatus, useWalletSupport } from '@/wallets/client/hooks'
import { WalletLogo } from '@/wallets/client/components/wallet-logo'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import rowsStyles from './rows.module.css'
import { COWBOY_CREDITS_ROUTE_ID } from '@/wallets/lib/routes'
import CheckIcon from '@/svgs/check-line.svg'
import DragIcon from '@/svgs/draggable.svg'
import Plug from '@/svgs/plug.svg'
import BountyIcon from '@/svgs/bounty-bag.svg'
import CowboyIcon from '@/svgs/cowboy.svg'
import { BalanceRow } from '@/wallets/client/components/balance'
import { useWalletBalanceState } from './balance'
import { WalletStatusPills } from './status'
import { kindSpec } from './state'
const styles = { ...sharedStyles, ...rowsStyles }

export function WalletList ({ entries, wallets, selectedRouteId, onSelect, variant, ordering, onReorder }) {
  const mobile = variant === 'mobileList'

  const list = (
    <div className={styles.walletList}>
      {entries.map((entry, index) => {
        const sectionLabel = kindSpec(entry)?.sectionLabel
        const previousSectionLabel = kindSpec(entries[index - 1])?.sectionLabel
        const showSectionLabel = sectionLabel && sectionLabel !== previousSectionLabel
        const externalIndex = entry.kind === 'external'
          ? wallets.findIndex(wallet => Number(wallet.id) === Number(entry.wallet.id))
          : -1
        const rowClassName = classNames(
          styles.surfaceRow,
          mobile ? styles.mobileWalletRow : styles.walletRow,
          mobile && styles.surfaceRowHover,
          entry.kind === 'external' && styles.externalWalletRow,
          entry.kind === 'add' && styles.addWalletRow,
          ordering && entry.kind === 'external' && styles.orderingWalletRow,
          entry.routeId === selectedRouteId && styles.selectedRing
        )
        const rowContent = (
          <>
            {ordering && entry.kind === 'external' && <DragIcon className={classNames(styles.orderDragIcon, 'text-muted')} />}
            <WalletRow entry={entry} showSelectedIcon={mobile && entry.routeId === selectedRouteId} />
          </>
        )
        const row = (
          <button
            type='button'
            className={rowClassName}
            onClick={() => {
              if (!ordering) onSelect(entry.routeId)
            }}
          >
            {rowContent}
          </button>
        )

        return (
          <Fragment key={entry.routeId}>
            {showSectionLabel && <div className={classNames(styles.walletSectionLabel, 'text-muted text-uppercase line-height-1')}>{sectionLabel}</div>}
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

export function WalletRow ({ entry, showSelectedIcon }) {
  if (entry.kind === 'add') {
    return <div className='fw-bold text-center line-height-1'>{entry.name}</div>
  }

  const spec = kindSpec(entry)

  return (
    <>
      <div className={styles.walletRowIdentity}>
        <div className={styles.walletRowLogoLine}>
          <WalletIcon entry={entry} />
          {spec.showName && <div className={classNames(styles.walletRowIdentityName, 'text-truncate fw-bold')}>{entry.name}</div>}
        </div>
        {spec.statusPills && <ExternalWalletStatus wallet={entry.wallet} />}
      </div>
      <WalletRowBalance entry={entry} />
      {showSelectedIcon && <CheckIcon width={18} height={18} className={styles.mobileWalletSelectedIcon} />}
    </>
  )
}

function WalletRowBalance ({ entry }) {
  return <BalanceRow balanceState={useWalletBalanceState(entry)} />
}

// Icon dispatch stays inline (not in the spec table): resolving a component via
// a call during render trips react-hooks/static-components, and this was always
// a single dispatch site.
export function WalletIcon ({ entry }) {
  if (entry.kind === 'external') {
    return <WalletLogo name={entry.wallet.name} className={styles.walletRowLogo} fallbackClassName={styles.walletRowFallback} />
  }
  if (entry.routeId === COWBOY_CREDITS_ROUTE_ID) return <CowboyIcon className={styles.internalWalletIcon} width={28} height={28} />
  if (entry.kind === 'add') return <Plug className={styles.internalWalletIcon} width={24} height={24} />
  return <BountyIcon className={styles.internalWalletIcon} width={28} height={28} />
}

function ExternalWalletStatus ({ wallet }) {
  const status = walletStatus(wallet)
  const support = useWalletSupport(wallet)

  return (
    <WalletStatusPills
      receive={support.receive ? status.receive : undefined}
      send={support.send ? status.send : undefined}
      className={classNames(styles.walletRowMeta, styles.walletRowIdentityMeta, 'd-flex flex-wrap align-items-center text-muted')}
    />
  )
}
