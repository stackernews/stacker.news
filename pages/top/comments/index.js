import Layout from '../../../components/layout'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import TopHeader from '../../../components/top-header'
import { TOP_COMMENTS } from '../../../fragments/comments'
import CommentsFlat from '../../../components/comments-flat'

export const getServerSideProps = getGetServerSideProps(TOP_COMMENTS)

export default function Index ({ data: { topComments: { comments, cursor } } }) {
  const router = useRouter()

  return (
    <Layout>
      <TopHeader cat='comments' />
      <CommentsFlat
        comments={comments} cursor={cursor}
        query={TOP_COMMENTS}
        destructureData={data => data.topComments}
        variables={{ sort: router.query.sort, when: router.query.when }}
        includeParent noReply
      />
    </Layout>
  )
}
