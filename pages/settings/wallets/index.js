import Layout from '@/components/layout'
import styles from '@/styles/wallet.module.css'
import { WalletCard } from '@/components/wallet-card'
import Link from 'next/link'
import { WALLET_DEFS } from '@/components/wallet'
import { getGetServerSideProps } from '@/api/ssrApollo'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  return (
    <Layout>
      <div className='py-5 w-100'>
        <h2 className='mb-2 text-center'>attach wallets</h2>
        <h6 className='text-muted text-center'>attach wallets to supplement your SN wallet</h6>
        <div className='text-center'>
          <Link href='/wallet/logs' className='text-muted fw-bold text-underline'>
            wallet logs
          </Link>
        </div>
        <div className={styles.walletGrid}>
          {WALLET_DEFS.map((def, i) =>
            <WalletCard key={i} name={def.name} {...def.card} />
          )}
        </div>
      </div>
    </Layout>
  )
}
