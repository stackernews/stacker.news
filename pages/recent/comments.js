import Layout from '../../components/layout'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { MORE_FLAT_COMMENTS } from '../../fragments/comments'
import CommentsFlat from '../../components/comments-flat'
import RecentHeader from '../../components/recent-header'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(MORE_FLAT_COMMENTS, variables)

export default function Index ({ data: { moreFlatComments: { comments, cursor } } }) {
  return (
    <Layout>
      <RecentHeader type='comments' />
      <CommentsFlat
        comments={comments} cursor={cursor}
        variables={{ sort: 'recent' }} includeParent noReply
      />
    </Layout>
  )
}
