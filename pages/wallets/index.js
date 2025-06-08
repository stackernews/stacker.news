import { getGetServerSideProps } from '@/api/ssrApollo'
import { Button } from 'react-bootstrap'
import { FIRST_PAGE, NEXT_PAGE, useWallets, useWalletsDispatch, usePage } from '@/wallets/client/context'
import { WalletLayout, WalletLayoutHeader, WalletLayoutLink, WalletLayoutSubHeader } from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'
import WalletCard from '@/wallets/client/components/card'
import { isTemplate, isUserWallet } from '@/wallets/lib/util'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const page = usePage()
  const wallets = useWallets()
  const dispatch = useWalletsDispatch()

  if (page === FIRST_PAGE) {
    return (
      <WalletLayout>
        <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1'>
          <Button
            onClick={() => dispatch({ type: NEXT_PAGE })}
            size='md' variant='secondary'
          >attach wallet
          </Button>
          <small className='d-block mt-3 text-muted'>attach a wallet to send and receive sats</small>
        </div>
      </WalletLayout>
    )
  }

  const userWallets = wallets.filter(w => isUserWallet(w))
  const walletTemplates = wallets.filter(w => isTemplate(w))

  return (
    <WalletLayout>
      <div className='py-5'>
        <WalletLayoutHeader>wallets</WalletLayoutHeader>
        <WalletLayoutSubHeader>use real bitcoin</WalletLayoutSubHeader>
        <div className='text-center'>
          <WalletLayoutLink href='/wallets/logs'>wallet logs</WalletLayoutLink>
        </div>
        <div className={styles.walletGrid}>
          {/* TODO(wallet-v2): filter templates based on search or filters */}
          {userWallets.map((w, i) => <WalletCard key={i} wallet={w} />)}
        </div>
        <div className={styles.separator} />
        <div className={styles.walletGrid}>
          {walletTemplates.map((w, i) => <WalletCard key={i} wallet={w} />)}
        </div>
      </div>
    </WalletLayout>
  )
}
