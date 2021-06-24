import { gql, useQuery } from '@apollo/client'
import CommentsFlat from '../components/comments-flat'
import Layout from '../components/layout'

export function RecentlyStacked () {
  const query = gql`
  {
    recentlyStacked
  }`
  const { data } = useQuery(query)
  if (!data || !data.recentlyStacked) return null

  return (
    <h2 className='visible text-success text-center py-3'>
      you stacked <span className='text-monospace'>{data.recentlyStacked}</span> sats
    </h2>
  )
}

export default function Notifications ({ user }) {
  return (
    <Layout>
      <RecentlyStacked />
      <h6 className='text-muted'>replies</h6>
      <CommentsFlat noReply includeParent clickToContext />
    </Layout>
  )
}
