import { getGetServerSideProps } from '@/api/ssrApollo'
import { Button } from 'react-bootstrap'
import { FIRST_PAGE, NEXT_PAGE, useWallets, useWalletsDispatch, usePage, UNLOCK_PAGE, useTemplates } from '@/wallets/client/context'
import { WalletCard, WalletLayout, WalletLayoutHeader, WalletLayoutLink, WalletLayoutSubHeader } from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'
import { usePassphrasePrompt, useShowPassphrase } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const page = usePage()
  const wallets = useWallets()
  const templates = useTemplates()
  const dispatch = useWalletsDispatch()
  const showPassphrase = useShowPassphrase()
  const passphrasePrompt = usePassphrasePrompt()

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

  if (page === UNLOCK_PAGE) {
    return (
      <WalletLayout>
        <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1'>
          <Button
            onClick={passphrasePrompt}
            size='md' variant='secondary'
          >unlock wallets
          </Button>
          <small className='d-block mt-3 text-muted'>your passphrase is required</small>
        </div>
      </WalletLayout>
    )
  }

  return (
    <WalletLayout>
      <div className='py-5'>
        <WalletLayoutHeader>wallets</WalletLayoutHeader>
        <WalletLayoutSubHeader>use real bitcoin</WalletLayoutSubHeader>
        <div className='text-center'>
          <WalletLayoutLink href='/wallets/logs'>wallet logs</WalletLayoutLink>
          <span className='mx-2'>•</span>
          <WalletLayoutLink href='/wallets/settings'>settings</WalletLayoutLink>
          {showPassphrase && (
            <>
              <span className='mx-2'>•</span>
              <Button
                variant='link'
                className='text-muted fw-bold text-underline p-0 align-baseline'
                onClick={showPassphrase}
              >
                passphrase
              </Button>
            </>
          )}
        </div>
        <div className={styles.walletGrid}>
          {/* TODO(wallet-v2): filter templates based on search or filters */}
          {wallets.map((w, i) => <WalletCard key={i} wallet={w} />)}
        </div>
        <div className={styles.separator} />
        <div className={styles.walletGrid}>
          {templates.map((w, i) => <WalletCard key={i} wallet={w} />)}
        </div>
      </div>
    </WalletLayout>
  )
}
