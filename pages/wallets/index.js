import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  DndProvider,
  useSetWalletPriorities,
  useTemplates,
  useWallets
} from '@/wallets/client/hooks'
import {
  WalletCard,
  WalletLayout,
  WalletLayoutHeader,
  WalletLayoutLink,
  WalletLayoutSubHeader,
  WalletRouteGateShell
} from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'
import { WalletSearch } from '@/wallets/client/components/search'
import { useCallback, useMemo, useState } from 'react'
import { walletDisplayName } from '@/wallets/lib/util'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const wallets = useWallets()
  const templates = useTemplates()
  const setWalletPriorities = useSetWalletPriorities()
  const [searchFilter, setSearchFilter] = useState(() => (text) => true)

  const { wallets: filteredWallets, templates: filteredTemplates } = useMemo(() => {
    const walletFilter = ({ name }) => searchFilter(walletDisplayName(name)) || searchFilter(name)
    return {
      wallets: wallets.filter(walletFilter),
      templates: templates.filter(walletFilter)
    }
  }, [wallets, templates, searchFilter])

  const handleWalletReorder = useCallback(async (reorderedVisibleWallets) => {
    let nextVisibleIndex = 0
    const reorderedVisibleIds = new Set(reorderedVisibleWallets.map(wallet => wallet.id))
    const reorderedWallets = wallets.map(wallet => {
      if (!reorderedVisibleIds.has(wallet.id)) {
        return wallet
      }

      return reorderedVisibleWallets[nextVisibleIndex++]
    })

    await setWalletPriorities(reorderedWallets)
  }, [wallets, setWalletPriorities])

  return (
    <WalletRouteGateShell>
      <WalletLayout>
        <div className='py-5'>
          <WalletLayoutHeader>wallets</WalletLayoutHeader>
          <WalletLayoutSubHeader>use real bitcoin</WalletLayoutSubHeader>
          <div className='text-center'>
            <WalletLayoutLink href='/wallets/logs'>wallet logs</WalletLayoutLink>
          </div>
          <WalletSearch setSearchFilter={setSearchFilter} />
          {filteredWallets.length > 0 && (
            <>
              <DndProvider items={filteredWallets} onReorder={handleWalletReorder}>
                <div className={styles.walletGrid}>
                  {filteredWallets.map((wallet, index) => (
                    <WalletCard
                      key={wallet.id}
                      wallet={wallet}
                      index={index}
                      draggable
                    />
                  ))}
                </div>
              </DndProvider>
              <div className={styles.separator} />
            </>
          )}
          <div className={styles.walletGrid}>
            {filteredTemplates.map((w, i) => <WalletCard key={i} wallet={w} />)}
          </div>
        </div>
      </WalletLayout>
    </WalletRouteGateShell>
  )
}
