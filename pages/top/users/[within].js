import Layout from '../../../components/layout'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import TopHeader from '../../../components/top-header'
import { TOP_USERS } from '../../../fragments/users'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import MoreFooter from '../../../components/more-footer'

export const getServerSideProps = getGetServerSideProps(TOP_USERS)

export default function Index ({ data: { topUsers: { users, cursor } } }) {
  const router = useRouter()

  const { data, fetchMore } = useQuery(TOP_USERS, {
    variables: { within: router.query?.within }
  })

  if (data) {
    ({ topUsers: { users, cursor } } = data)
  }

  return (
    <Layout>
      <TopHeader cat='users' />
      {users.map(user => (
        <Link href={`/${user.name}`} key={user.name}>
          <div className='d-flex align-items-center pointer'>
            <h3 className='mb-0'>@{user.name}</h3>
            <h2 className='ml-2 mb-0'><small className='text-success'>{user.stacked} stacked</small></h2>
          </div>
        </Link>
      ))}
      <MoreFooter cursor={cursor} fetchMore={fetchMore} Skeleton={UsersSkeleton} />
    </Layout>
  )
}

function UsersSkeleton () {
  const users = new Array(21).fill(null)

  return (
    <div>{users.map((_, i) => (
      <div key={i} className='d-flex align-items-center' style={{ height: '34px' }}>
        <div className='clouds' style={{ width: '172px', borderRadius: '.4rem', height: '27px' }} />
        <div className='ml-2 clouds' style={{ width: '137px', borderRadius: '.4rem', height: '30px', margin: '3px 0px' }} />
      </div>
    ))}
    </div>
  )
}
