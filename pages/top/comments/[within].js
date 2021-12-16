import Layout from '../../../components/layout'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import TopHeader from '../../../components/top-header'
import { MORE_FLAT_COMMENTS } from '../../../fragments/comments'
import CommentsFlat from '../../../components/comments-flat'

export const getServerSideProps = getGetServerSideProps(MORE_FLAT_COMMENTS, { sort: 'top' })

export default function Index ({ data: { moreFlatComments: { comments, cursor } } }) {
  const router = useRouter()

  return (
    <Layout>
      <TopHeader cat='comments' />
      <CommentsFlat
        comments={comments} cursor={cursor}
        variables={{ sort: 'top', within: router.query?.within }}
        includeParent noReply
      />
    </Layout>
  )
}
