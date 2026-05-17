import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletErrorShell, WalletLayoutImageOrName, WalletLoadingShell, WalletLogs, WalletRouteGateShell, WalletShell } from '@/wallets/client/components'
import { useWallets } from '@/wallets/client/hooks'
import styles from '@/styles/wallet.module.css'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletLogsPage () {
  const router = useRouter()
  const wallets = useWallets()
  const wallet = useMemo(() => {
    const id = Number(router.query.id)
    if (!Number.isSafeInteger(id)) return null
    return wallets.find(wallet => Number(wallet.id) === id) ?? null
  }, [router.query.id, wallets])

  return (
    <WalletRouteGateShell>
      {!router.isReady
        ? <WalletLoadingShell />
        : !wallet
            ? <WalletErrorShell title='wallet not found' message='this wallet could not be found' />
            : (
              <WalletShell noSidebar>
                <main className={styles.walletMain}>
                  <div className={styles.walletDetailPage}>
                    <WalletDetailHeader wallet={wallet} title='logs' />
                    <WalletLogs wallet={wallet} />
                  </div>
                </main>
              </WalletShell>
              )}
    </WalletRouteGateShell>
  )
}

function WalletDetailHeader ({ wallet, title }) {
  return (
    <header className={styles.walletDetailHeader}>
      <h1>{title}</h1>
      <div className={styles.walletActionWallet}>
        <WalletLayoutImageOrName name={wallet.name} maxHeight='18px' />
      </div>
    </header>
  )
}
