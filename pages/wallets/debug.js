import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLayoutHeader, WalletDebugSettings, WalletLogs, WalletShell } from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletDebug () {
  return (
    <WalletShell noSidebar>
      <main className={styles.walletMain}>
        <div className='py-5 mx-auto w-100' style={{ maxWidth: '600px' }}>
          <WalletLayoutHeader>wallet debug</WalletLayoutHeader>
          <WalletDebugSettings />
          <WalletLogs className='mt-3' debug />
        </div>
      </main>
    </WalletShell>
  )
}
