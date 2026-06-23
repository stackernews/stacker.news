import { getGetServerSideProps } from '@/api/ssrApollo'
import { SATISTICS } from '@/fragments/payIn'
import MoreFooter from '@/components/more-footer'
import PayInTable, { PayInSkeleton } from '@/components/payIn/table'
import { useData } from '@/components/use-data'
import { WalletDetailRoutePage } from '@/wallets/client/components'
import { useRouteWallet } from '@/wallets/client/hooks'
import { useQuery } from '@apollo/client/react'
import { useCallback, useMemo } from 'react'

export const getServerSideProps = getGetServerSideProps({
  query: SATISTICS,
  variables: ({ id }) => ({ walletId: id }),
  authRequired: true
})

export default function WalletActivityPage ({ ssrData }) {
  const { wallet, ready } = useRouteWallet()

  return (
    <WalletDetailRoutePage ready={ready} resource={wallet} title='activity'>
      {wallet => <WalletActivity wallet={wallet} ssrData={ssrData} />}
    </WalletDetailRoutePage>
  )
}

function WalletActivity ({ wallet, ssrData }) {
  const variables = useMemo(() => ({ walletId: wallet.id }), [wallet.id])
  const { data, fetchMore } = useQuery(SATISTICS, { variables })
  const dat = useData(data, ssrData)
  const items = dat?.satistics?.txs
  const fetchMoreActivity = useCallback(({ variables: nextVariables }) => {
    return fetchMore({ variables: { ...variables, ...nextVariables } })
  }, [fetchMore, variables])

  if (!dat) return <PayInSkeleton header />

  const cursor = dat.satistics?.cursor

  return items?.length > 0
    ? (
      <>
        <PayInTable items={items} />
        <MoreFooter cursor={cursor} count={items?.length} fetchMore={fetchMoreActivity} Skeleton={PayInSkeleton} />
      </>
      )
    : <p className='text-muted mb-0'>no activity</p>
}
