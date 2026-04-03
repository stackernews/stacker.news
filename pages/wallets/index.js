import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  DndProvider, KeyStatus, useWallets, useTemplates, useWalletsLoading, useKeyError, useWalletsError,
  useNeedsPassphraseSetup, usePassphrasePrompt, usePassphraseSetup, useSetWalletPriorities
} from '@/wallets/client/hooks'
import {
  WalletCard,
  WalletCenteredPromptShell,
  WalletErrorShell,
  WalletKeyStorageUnavailableShell,
  WalletLayout,
  WalletLayoutHeader,
  WalletLayoutLink,
  WalletLayoutSubHeader,
  WalletLoadingShell
} from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'
import { WalletSearch } from '@/wallets/client/components/search'
import { useCallback, useMemo, useState } from 'react'
import { walletDisplayName } from '@/wallets/lib/util'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const wallets = useWallets()
  const walletsLoading = useWalletsLoading()
  const walletsError = useWalletsError()
  const keyError = useKeyError()
  const needsPassphraseSetup = useNeedsPassphraseSetup()
  const templates = useTemplates()
  const { SetupPrompt } = usePassphraseSetup()
  const PassphrasePrompt = usePassphrasePrompt({ showCancel: false })
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

  if (keyError === KeyStatus.KEY_STORAGE_UNAVAILABLE) {
    return <WalletKeyStorageUnavailableShell />
  }

  if (keyError === KeyStatus.WRONG_KEY) {
    return (
      <WalletCenteredPromptShell>
        {PassphrasePrompt}
      </WalletCenteredPromptShell>
    )
  }

  if (walletsError) {
    return (
      <WalletErrorShell
        title='failed to load wallets'
        message={walletsError.message}
      />
    )
  }

  if (walletsLoading) {
    return <WalletLoadingShell />
  }

  if (needsPassphraseSetup) {
    return (
      <WalletCenteredPromptShell>
        {SetupPrompt}
      </WalletCenteredPromptShell>
    )
  }

  return (
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
  )
}
