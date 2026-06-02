import Link from 'next/link'
import classNames from 'classnames'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import shellStyles from '@/wallets/client/components/layout.module.css'
import rowsStyles from './rows.module.css'
import panelStyles from './panel.module.css'
import { AddWalletPanel } from './add'
import { WalletActions } from './actions'
import { BalanceHero } from '@/wallets/client/components/balance'
import { useWalletBalanceState } from './balance'
import { WalletIcon } from './list'
import { kindSpec } from './state'
const styles = { ...sharedStyles, ...shellStyles, ...rowsStyles, ...panelStyles }

export function SelectedWalletPanel ({ entry, templates }) {
  if (!entry) return null
  if (entry.kind === 'add') return <AddWalletPanel templates={templates} />
  const spec = kindSpec(entry)

  return (
    <div className={classNames(styles.panel, styles.walletMainFlushChild, 'd-flex flex-column align-items-center')}>
      <div className='w-100 d-none d-md-flex align-items-start justify-content-between gap-4'>
        <div className={classNames(styles.selectedWalletIdentity, 'd-inline-flex align-items-center text-body fw-bold')}>
          <WalletIcon entry={entry} />
          {spec.showName && <span>{entry.name}</span>}
        </div>
        {spec.detailTabs && (
          <nav className='d-none d-md-flex justify-content-end gap-4'>
            {spec.detailItems(entry).map(item => (
              <Link key={item.key} href={item.href} className={styles.textButton}>{item.label}</Link>
            ))}
          </nav>
        )}
      </div>
      <SelectedWalletBalance entry={entry} />
      <WalletActions entry={entry} />
    </div>
  )
}

function SelectedWalletBalance ({ entry }) {
  return <BalanceHero balanceState={useWalletBalanceState(entry)} />
}

export function WalletDetailsList ({ entry, onSelect }) {
  if (!entry || entry.kind === 'add') return null

  const items = kindSpec(entry).detailItems(entry)

  return (
    <div className={styles.stackSection}>
      {items.map(item => (
        <Link key={item.key} href={item.href} className={classNames(styles.surfaceRow, styles.surfaceRowHover, 'd-flex align-items-center fw-bold')} onClick={onSelect}>
          {item.label}
        </Link>
      ))}
    </div>
  )
}
