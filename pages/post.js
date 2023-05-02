import Button from 'react-bootstrap/Button'
import { useRouter } from 'next/router'
import Link from 'next/link'
import LayoutCenter from '../components/layout-center'
import { useMe } from '../components/me'
import { DiscussionForm } from '../components/discussion-form'
import { LinkForm } from '../components/link-form'
import { getGetServerSideProps } from '../api/ssrApollo'
import AccordianItem from '../components/accordian-item'
import { PollForm } from '../components/poll-form'
import { BountyForm } from '../components/bounty-form'
import { Form, Select } from '../components/form'
import { useEffect, useState } from 'react'
import Info from '../components/info'

export const getServerSideProps = getGetServerSideProps()

export function PostForm () {
  const router = useRouter()
  const me = useMe()

  if (!router.query.type) {
    return (
      <div className='align-items-center'>
        {me?.freePosts && me?.sats < 1
          ? <div className='text-center font-weight-bold mb-3 text-success'>{me.freePosts} free posts left</div>
          : null}
        <Link href='/post?type=link'>
          <Button variant='secondary'>link</Button>
        </Link>
        <span className='mx-3 font-weight-bold text-muted'>or</span>
        <Link href='/post?type=discussion'>
          <Button variant='secondary'>discussion</Button>
        </Link>
        <div className='d-flex mt-3'>
          <AccordianItem
            headerColor='#6c757d'
            header={<div className='font-weight-bold text-muted'>more</div>}
            body={
              <div className='align-items-center'>
                <Link href='/post?type=poll'>
                  <Button variant='info'>poll</Button>
                </Link>
                <span className='mx-3 font-weight-bold text-muted'>or</span>
                <Link href='/post?type=bounty'>
                  <Button variant='info'>bounty</Button>
                </Link>
              </div>
            }
          />
        </div>
      </div>
    )
  }

  if (router.query.type === 'discussion') {
    return <DiscussionForm adv />
  } else if (router.query.type === 'link') {
    return <LinkForm />
  } else if (router.query.type === 'poll') {
    return <PollForm />
  } else {
    return <BountyForm adv />
  }
}

export function SubSelect ({ children }) {
  const router = useRouter()
  const [sub, setSub] = useState(router.query.sub || 'bitcoin')

  useEffect(() => {
    setSub(router.query.sub || 'bitcoin')
  }, [router.query?.sub])

  return (
    <div className='mb-3 d-flex justify-content-start'>
      <Form
        className='w-auto d-flex align-items-center'
        initial={{
          sub
        }}
      >
        <Select
          groupClassName='mb-0'
          onChange={(formik, e) =>
            // todo move the form values to the other sub's post form
            router.push({
              pathname: `/~${e.target.value}/post`,
              query: router.query?.type ? { type: router.query.type } : undefined
            })}
          name='sub'
          size='sm'
          items={router.query?.type ? ['bitcoin', 'nostr'] : ['bitcoin', 'nostr', 'jobs']}
        />
        <Info>
          <div>
            <div className='font-weight-bold'>The sub your post will go in ...</div>
            <ul>
              <li>If it's bitcoin related, put it in the bitcoin sub.</li>
              <li>If it's nostr related, put it in the nostr sub.</li>
              <li>If it's a job, put it in the jobs sub.</li>
            </ul>
          </div>
        </Info>
      </Form>
      {children}
    </div>
  )
}

export default function Post () {
  return (
    <LayoutCenter>
      <SubSelect />
      <PostForm />
    </LayoutCenter>
  )
}
