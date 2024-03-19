import { SearchLayout } from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { USER_SEARCH } from '@/fragments/users'
import UserList from '@/components/user-list'
import { useRouter } from 'next/router'

const staticVariables = { limit: 21, similarity: 0.2 }
export const getServerSideProps = getGetServerSideProps({ query: USER_SEARCH, variables: staticVariables })

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = { ...staticVariables, ...router.query }

  return (
    <SearchLayout>
      <UserList
        ssrData={ssrData} query={USER_SEARCH}
        destructureData={data => ({ users: data.searchUsers })} variables={variables}
      />
    </SearchLayout>
  )
}
