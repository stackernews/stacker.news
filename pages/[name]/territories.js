import { getGetServerSideProps } from '@/api/ssrApollo'
import { useRouter } from 'next/router'
import { USER, USER_WITH_SUBS } from '@/fragments/users'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import { UserLayout } from '.'
import TerritoryList from '@/components/territory-list'

export const getServerSideProps = getGetServerSideProps({ query: USER_WITH_SUBS })

export default function UserTerritories ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }

  const { data } = useQuery(USER, { variables })
  if (!data && !ssrData) return <PageLoading />

  const { user } = data || ssrData

  return (
    <UserLayout user={user}>
      <div className='mt-2'>
        <TerritoryList
          ssrData={ssrData}
          query={USER_WITH_SUBS}
          variables={variables}
          destructureData={data => data.userSubs}
          subActionDropdown
          rank
        />
      </div>
    </UserLayout>
  )
}
