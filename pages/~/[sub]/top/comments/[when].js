import Layout from '../../../../../components/layout'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../../../api/ssrApollo'
import TopHeader from '../../../../../components/top-header'
import { SUB_TOP_COMMENTS } from '../../../../../fragments/subs'
import CommentsFlat from '../../../../../components/comments-flat'

export const getServerSideProps = getGetServerSideProps(SUB_TOP_COMMENTS, undefined, data => !data.sub)

export default function Index ({ data: { sub, topComments: { comments, cursor } } }) {
  const router = useRouter()

  return (
    <Layout sub={sub?.name}>
      <TopHeader sub={sub?.name} cat='comments' />
      <CommentsFlat
        comments={comments} cursor={cursor}
        query={SUB_TOP_COMMENTS}
        destructureData={data => data.topComments}
        variables={{ sub: sub?.name, sort: router.query.sort, when: router.query.when }}
        includeParent noReply
      />
    </Layout>
  )
}
