import { useState } from 'react'
import Link from 'next/link'
import classNames from 'classnames'
import { useWalletSupport } from '@/wallets/client/hooks'
import { fuzzySearch, WalletSearch } from '@/wallets/client/components/search'
import { WalletLogo } from '@/wallets/client/components/wallet-logo'
import { templateNameToPathSegment, walletDisplayName } from '@/wallets/lib/util'
import { addWalletTemplateRoute } from '@/wallets/lib/routes'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import rowsStyles from './rows.module.css'
import addStyles from './add.module.css'
import { WalletStatusPills } from './status'
import { SparkCustodyNotice } from './spark-custody-notice'
import { usePlatformLightning } from '@/components/platform-lightning'
import { WALLET_CREATION_MAINTENANCE_MESSAGE } from '@/wallets/lib/maintenance'
const styles = { ...sharedStyles, ...rowsStyles, ...addStyles }

export function AddWalletPanel ({ templates }) {
  const { available } = usePlatformLightning()
  const [query, setQuery] = useState('')

  if (!available) {
    return (
      <div className={styles.panel}>
        <h2>add wallet</h2>
        <p className='text-muted mb-0'>{WALLET_CREATION_MAINTENANCE_MESSAGE}</p>
      </div>
    )
  }

  const searchFilter = fuzzySearch(query)
  const templateMatches = templates.map(template => ({
    template,
    visible: searchFilter(walletDisplayName(template.name)) || searchFilter(template.name)
  }))
  const hasVisibleTemplate = templateMatches.some(({ visible }) => visible)

  return (
    <div className={styles.panel}>
      <h2>add wallet</h2>
      <p className='text-muted'>Choose a wallet to connect.</p>
      <WalletSearch query={query} onQueryChange={setQuery} />
      <div className='d-flex flex-column gap-3'>
        {templateMatches.map(({ template, visible }) => (
          <Link
            key={template.name}
            href={addWalletTemplateRoute(templateNameToPathSegment(template.name))}
            className={classNames(styles.surfaceRow, styles.surfaceRowHover, styles.row)}
            hidden={!visible}
          >
            <AddWalletTemplateLabel template={template} />
            <TemplateWalletSupport template={template} />
          </Link>
        ))}
        {!hasVisibleTemplate && (
          <div className='d-flex flex-column align-items-center justify-content-center text-center text-muted py-5 px-3'>
            no wallets found
          </div>
        )}
      </div>
    </div>
  )
}

function AddWalletTemplateLabel ({ template }) {
  return (
    <div className={styles.templateLabel}>
      <WalletLogo name={template.name} fallback='name' className={styles.logo} fallbackClassName='d-inline fw-bold' />
      <SparkCustodyNotice wallet={template} />
    </div>
  )
}

function TemplateWalletSupport ({ template }) {
  const support = useWalletSupport(template)

  return (
    <WalletStatusPills
      receive={support.receive ? 'SUPPORTED' : undefined}
      send={support.send ? 'SUPPORTED' : undefined}
      className={styles.templateSupport}
    />
  )
}
