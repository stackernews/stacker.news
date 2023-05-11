import { getGetServerSideProps } from '../../../api/ssrApollo'
import { SUB } from '../../../fragments/subs'
import LayoutCenter from '../../../components/layout-center'
import Post from '../../../components/post'

export const getServerSideProps = getGetServerSideProps(SUB, null,
  data => !data.sub)

export default function PostPage ({ data: { sub } }) {
  return (
    <LayoutCenter sub={sub.name}>
      <Post sub={sub} />
    </LayoutCenter>
  )
}
