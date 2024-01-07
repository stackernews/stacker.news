import { getGetServerSideProps } from '../../../api/ssrApollo'
import Layout from '../../../components/layout'
import styles from '../../../styles/wallet.module.css'
import { WalletCard } from '../../../components/wallet-card'
import { LightningAddressWalletCard } from './lightning-address'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  return (
    <Layout>
      <div className='py-5 w-100'>
        <h2 className='mb-2 text-center'>attach wallets</h2>
        <h6 className='text-muted text-center'>attach wallets to supplement your SN wallet</h6>
        <div className={styles.walletGrid}>
          <LightningAddressWalletCard />
          <WalletCard title='coming soon' badges={['probably']} />
          <WalletCard title='coming soon' badges={['we hope']} />
          <WalletCard title='coming soon' badges={['tm']} />
        </div>
      </div>
    </Layout>
  )
}
