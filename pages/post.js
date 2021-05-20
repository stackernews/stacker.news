import Button from 'react-bootstrap/Button'
import { Form, Input, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import Link from 'next/link'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import LayoutCenter from '../components/layout-center'
import { ensureProtocol } from '../lib/url'

export const DiscussionSchema = Yup.object({
  title: Yup.string().required('required').trim()
})

export function DiscussionForm () {
  const router = useRouter()
  const [createDiscussion] = useMutation(
    gql`
      mutation createDiscussion($title: String!, $text: String) {
        createDiscussion(title: $title, text: $text) {
          id
        }
      }`
  )

  return (
    <Form
      initial={{
        title: '',
        text: ''
      }}
      schema={DiscussionSchema}
      onSubmit={async (values) => {
        const { data: { createDiscussion: { id } }, error } = await createDiscussion({ variables: values })
        if (error) {
          throw new Error({ message: error.toString() })
        }
        router.push(`items/${id}`)
      }}
    >
      <Input
        label='title'
        name='title'
        required
        autoFocus
      />
      <Input
        label={<>text <small className='text-muted ml-2'>optional</small></>}
        name='text'
        as='textarea'
        rows={4}
      />
      <SubmitButton variant='secondary' className='mt-2'>post</SubmitButton>
    </Form>
  )
}

export const LinkSchema = Yup.object({
  title: Yup.string().required('required').trim(),
  url: Yup.string().test({
    name: 'url',
    test: (value) => {
      try {
        value = ensureProtocol(value)
        const valid = new URL(value)
        return Boolean(valid)
      } catch {
        return false
      }
    },
    message: 'invalid url'
  }).required('required')
})

export function LinkForm () {
  const router = useRouter()
  const [createLink] = useMutation(
    gql`
      mutation createLink($title: String!, $url: String!) {
        createLink(title: $title, url: $url) {
          id
        }
      }`
  )

  return (
    <Form
      initial={{
        title: '',
        url: ''
      }}
      schema={LinkSchema}
      onSubmit={async (values) => {
        const { data: { createLink: { id } }, error } = await createLink({ variables: values })
        if (error) {
          throw new Error({ message: error.toString() })
        }
        router.push(`items/${id}`)
      }}
    >
      <Input
        label='title'
        name='title'
        required
        autoFocus
      />
      <Input
        label='url'
        name='url'
        required
      />
      <SubmitButton variant='secondary' className='mt-2'>post</SubmitButton>
    </Form>
  )
}

export function PostForm () {
  const router = useRouter()

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
    <LayoutCenter>
      <PostForm />
    </LayoutCenter>
  )
}
