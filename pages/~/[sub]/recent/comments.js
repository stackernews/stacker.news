import Layout from '../../../../components/layout'
import { getGetServerSideProps } from '../../../../api/ssrApollo'
import CommentsFlat from '../../../../components/comments-flat'
import RecentHeader from '../../../../components/recent-header'
import { SUB_FLAT_COMMENTS } from '../../../../fragments/subs'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(SUB_FLAT_COMMENTS, variables)

export default function Index ({ data: { sub, moreFlatComments: { comments, cursor } } }) {
  return (
    <Layout>
      <RecentHeader type='comments' sub={sub} />
      <CommentsFlat
        comments={comments} cursor={cursor}
        variables={{ sort: 'recent', sub: sub?.name }} includeParent noReply
      />
    </Layout>
  )
}
