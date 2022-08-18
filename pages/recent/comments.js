import Layout from '../../components/layout'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { MORE_FLAT_COMMENTS } from '../../fragments/comments'
import CommentsFlat from '../../components/comments-flat'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(MORE_FLAT_COMMENTS, variables)

export default function Index ({ data: { moreFlatComments: { comments, cursor } } }) {
  return (
    <Layout>
      <CommentsFlat
        comments={comments} cursor={cursor}
        variables={{ sort: 'recent' }} includeParent noReply
      />
    </Layout>
  )
}
