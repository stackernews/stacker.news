import { getGetServerSideProps } from '@/api/ssrApollo'
import { WALLET_ACTIVITY } from '@/fragments/payIn'
import MoreFooter from '@/components/more-footer'
import PayInTable, { PayInSkeleton } from '@/components/payIn/table'
import { WalletErrorShell, WalletLayoutImageOrName, WalletLoadingShell, WalletRouteGateShell, WalletShell } from '@/wallets/client/components'
import { useWallets } from '@/wallets/client/hooks'
import styles from '@/styles/wallet.module.css'
import { useQuery } from '@apollo/client/react'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletActivityPage () {
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
                    <WalletDetailHeader wallet={wallet} title='activity' />
                    <WalletActivity wallet={wallet} />
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

function WalletActivity ({ wallet }) {
  const variables = useMemo(() => ({ walletId: wallet.id }), [wallet.id])
  const { data, fetchMore, loading } = useQuery(WALLET_ACTIVITY, { variables })
  const payIns = data?.satistics?.payIns
  const cursor = data?.satistics?.cursor
  const fetchMoreActivity = useCallback(({ variables: nextVariables }) => {
    return fetchMore({ variables: { ...variables, ...nextVariables } })
  }, [fetchMore, variables])

  if (loading && !payIns) return <PayInSkeleton header />

  return payIns?.length > 0
    ? (
      <>
        <PayInTable payIns={payIns} />
        <MoreFooter cursor={cursor} count={payIns?.length} fetchMore={fetchMoreActivity} Skeleton={PayInSkeleton} />
      </>
      )
    : <p className='text-muted mb-0'>no activity</p>
}
