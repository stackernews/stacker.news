import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Layout from '../components/layout'
import { useRouter } from 'next/router'
import Link from 'next/link'
import styles from '../styles/post.module.css'

export function DiscussionForm () {
  return (
    <Form>
      <Form.Group>
        <Form.Label>title</Form.Label>
        <Form.Control type='text' />
      </Form.Group>
      <Form.Group>
        <Form.Label>text <small className='text-muted ml-2'>optional</small></Form.Label>
        <Form.Control as='textarea' rows={4} />
      </Form.Group>
      <Button className='mt-2' variant='main' size='lg' type='submit'>post</Button>
    </Form>
  )
}

export function LinkForm () {
  return (
    <Form>
      <Form.Group>
        <Form.Label>title</Form.Label>
        <Form.Control type='text' />
      </Form.Group>
      <Form.Group>
        <Form.Label>url</Form.Label>
        <Form.Control type='url' />
      </Form.Group>
      <Button className='mt-2' variant='main' size='lg' type='submit'>post</Button>
    </Form>
  )
}

export function PostForm () {
  const router = useRouter()

  if (!router.query.type) {
    return (
      <div className='align-items-center'>
        <Link href='/post?type=link'>
          <Button variant='main' size='lg'>link</Button>
        </Link>
        <span className='mx-3 font-weight-bold text-muted'>or</span>
        <Link href='/post?type=discussion'>
          <Button variant='main' size='lg'> discussion</Button>
        </Link>
      </div>
    )
  }

  if (router.query.type === 'discussion') {
    return <DiscussionForm />
  } else {
    return <LinkForm />
  }
}

export default function Post () {
  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.post}>
          <PostForm />
        </div>
      </div>
    </Layout>
  )
}
