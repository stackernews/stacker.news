import { getGetServerSideProps } from '@/api/ssrApollo'
import { Button } from 'react-bootstrap'
import { useWallets, useTemplates, DndProvider, Status, useStatus } from '@/wallets/client/context'
import { WalletCard, WalletLayout, WalletLayoutHeader, WalletLayoutLink, WalletLayoutSubHeader } from '@/wallets/client/components'
import styles from '@/styles/wallet.module.css'
import { usePassphrasePrompt, useShowPassphrase, useSetWalletPriorities } from '@/wallets/client/hooks'
import { WalletSearch } from '@/wallets/client/components/search'
import { useMemo, useState } from 'react'
import { walletDisplayName } from '@/wallets/lib/util'
import Moon from '@/svgs/moon-fill.svg'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const wallets = useWallets()
  const status = useStatus()
  const [showWallets, setShowWallets] = useState(false)
  const templates = useTemplates()
  const showPassphrase = useShowPassphrase()
  const passphrasePrompt = usePassphrasePrompt()
  const setWalletPriorities = useSetWalletPriorities()
  const [searchFilter, setSearchFilter] = useState(() => (text) => true)

  const { wallets: filteredWallets, templates: filteredTemplates } = useMemo(() => {
    const walletFilter = ({ name }) => searchFilter(walletDisplayName(name)) || searchFilter(name)
    return {
      wallets: wallets.filter(walletFilter),
      templates: templates.filter(walletFilter)
    }
  }, [wallets, templates, searchFilter])

  if (status === Status.LOADING_WALLETS) {
    return (
      <WalletLayout>
        <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted'>
          <Moon className='spin fill-grey' height={28} width={28} />
          <small className='d-block mt-3 text-muted'>loading wallets</small>
        </div>
      </WalletLayout>
    )
  }

  if (status === Status.PASSPHRASE_REQUIRED) {
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

  if (status === Status.WALLETS_UNAVAILABLE) {
    return (
      <WalletLayout>
        <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1'>
          <span className='text-muted fw-bold my-1'>wallets unavailable</span>
          <small className='d-block text-muted'>
            this device does not support storage of cryptographic keys via IndexedDB
          </small>
        </div>
      </WalletLayout>
    )
  }

  if (status === Status.NO_WALLETS && !showWallets) {
    return (
      <WalletLayout>
        <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1'>
          <Button
            onClick={() => setShowWallets(true)}
            size='md' variant='secondary'
          >attach wallet
          </Button>
          <small className='d-block mt-3 text-muted'>attach a wallet to send and receive sats</small>
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
        <WalletSearch setSearchFilter={setSearchFilter} />
        {filteredWallets.length > 0 && (
          <>
            <DndProvider items={filteredWallets} onReorder={setWalletPriorities}>
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
