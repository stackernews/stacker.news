import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLayoutHeader, WalletLogs, WalletShell } from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletLogsPage () {
  return (
    <WalletShell noSidebar>
      <main className={styles.walletMain}>
        <div className='py-5'>
          <WalletLayoutHeader>wallet logs</WalletLayoutHeader>
          <WalletLogs />
        </div>
      </main>
    </WalletShell>
  )
}
