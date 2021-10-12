import Button from 'react-bootstrap/Button'
import { useRouter } from 'next/router'
import Link from 'next/link'
import LayoutCenter from '../components/layout-center'
import { useMe } from '../components/me'
import { DiscussionForm } from '../components/discussion-form'
import { LinkForm } from '../components/link-form'

export async function getServerSideProps () {
  return {
    props: {}
  }
}

export function PostForm () {
  const router = useRouter()
  const me = useMe()

  if (!router.query.type) {
    return (
      <div className='align-items-center'>
        <Link href='/post?type=link'>
          <Button variant='secondary'>link</Button>
        </Link>
        <span className='mx-3 font-weight-bold text-muted'>or</span>
        <Link href='/post?type=discussion'>
          <Button variant='secondary'>discussion</Button>
        </Link>
        {me?.freePosts
          ? <div className='text-center font-weight-bold mt-3 text-success'>{me.freePosts} free posts left</div>
          : null}
      </div>
    )
  }

  if (router.query.type === 'discussion') {
    return <DiscussionForm adv />
  } else {
    return <LinkForm />
  }
}

export default function Post () {
  return (
    <LayoutCenter>
      <PostForm />
    </LayoutCenter>
  )
}
