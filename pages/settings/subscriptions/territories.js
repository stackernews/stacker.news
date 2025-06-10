import { useMemo } from 'react'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { MY_SUBSCRIBED_SUBS } from '@/fragments/users'
import TerritoryList from '@/components/territory-list'
import { SubscribeTerritoryContextProvider } from '@/components/territory-header'
import { SubscriptionLayout } from './stackers'

export const getServerSideProps = getGetServerSideProps({
  query: MY_SUBSCRIBED_SUBS,
  authRequired: true
})

export default function MySubscribedSubs ({ ssrData }) {
  const subscribeContextValue = useMemo(() => ({ refetchQueries: ['MySubscribedSubs'] }), [])
  return (
    <SubscriptionLayout subType='territories'>
      <SubscribeTerritoryContextProvider value={subscribeContextValue}>
        <TerritoryList
          ssrData={ssrData}
          query={MY_SUBSCRIBED_SUBS}
          variables={{}}
          destructureData={data => data.mySubscribedSubs}
          rank
          statCompsProp={[]}
        />
      </SubscribeTerritoryContextProvider>
    </SubscriptionLayout>
  )
}
