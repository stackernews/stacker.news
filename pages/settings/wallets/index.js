import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import styles from '@/styles/wallet.module.css'
import { WalletCard } from '@/components/wallet-card'
import { LightningAddressWalletCard } from './lightning-address'
import { LNbitsCard } from './lnbits'
import { NWCCard } from './nwc'
import { LNDCard } from './lnd'
import { CLNCard } from './cln'
import { WALLETS } from '@/fragments/wallet'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import { LNCCard } from './lnc'
import Link from 'next/link'
import { Wallet as W } from '@/lib/constants'

export const getServerSideProps = getGetServerSideProps({ query: WALLETS, authRequired: true })

export default function Wallet ({ ssrData }) {
  const { data } = useQuery(WALLETS)

  if (!data && !ssrData) return <PageLoading />
  const { wallets } = data || ssrData
  const lnd = wallets.find(w => w.type === W.LND.type)
  const lnaddr = wallets.find(w => w.type === W.LnAddr.type)
  const cln = wallets.find(w => w.type === W.CLN.type)

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
          <LightningAddressWalletCard wallet={lnaddr} />
          <LNDCard wallet={lnd} />
          <CLNCard wallet={cln} />
          <LNbitsCard />
          <NWCCard />
          <LNCCard />
          <WalletCard title='coming soon' badges={['probably']} />
          <WalletCard title='coming soon' badges={['we hope']} />
          <WalletCard title='coming soon' badges={['tm']} />
        </div>
      </div>
    </Layout>
  )
}
