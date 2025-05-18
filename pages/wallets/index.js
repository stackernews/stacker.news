import { Fragment } from 'react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { Button } from 'react-bootstrap'
import { FIRST_PAGE, NEXT_PAGE, useWallets, useWalletsDispatch } from '@/wallets/provider'
import WalletLayout, { WalletLayoutHeader, WalletLayoutImageOrName, WalletLayoutLink, WalletLayoutSubHeader } from '@/components/wallet/layout'
import { useRouter } from 'next/router'
import { walletNameToUrlName } from '@/wallets/json'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const { page, wallets } = useWallets()
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

  return (
    <WalletLayout>
      <div className='py-5 d-flex flex-column align-items-center justify-content-center flex-grow-1'>
        <WalletLayoutHeader>wallets</WalletLayoutHeader>
        <WalletLayoutSubHeader>use real bitcoin</WalletLayoutSubHeader>
        <div className='text-center'>
          <WalletLayoutLink href='/wallets/logs'>wallet logs</WalletLayoutLink>
        </div>
        <div>
          <div className='d-flex flex-column gap-3 pt-5'>
            {wallets
              .filter(w => {
                // TODO(wallet-v2): filter templates based on search or filters
                return true
              })
              .map((w, i) => {
                return (
                  <Fragment key={`${w.__typename}-${w.id}`}>
                    <WalletLayoutImageOrName name={w.name} />
                    <WalletButtons wallet={w} />
                    <hr style={{ gridColumn: '1 / -1' }} />
                  </Fragment>
                )
              })}
          </div>
        </div>
      </div>
    </WalletLayout>
  )
}

function WalletButtons ({ wallet }) {
  const router = useRouter()
  const configured = wallet.__typename === 'UserWallet' && (wallet.send || wallet.receive)

  function onClick () {
    // TODO(wallet-v2): implement wallet forms
    // if it's a UserWallet, we need to go to /wallets/:id to edit the wallet
    // if it's a WalletTemplate, we need to go to /wallets/:name to create a new wallet
    router.push(`/wallets/${walletNameToUrlName(wallet.name)}`)
  }

  // TODO(wallet-v2): add context menu to create a new wallet from a template
  return (
    <div className='d-flex justify-content-center'>
      <Button
        size='sm'
        variant='secondary'
        onClick={onClick}
        className='px-3'
      >
        {configured ? 'edit' : 'attach'}
      </Button>
    </div>
  )
}
