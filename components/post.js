import JobForm from './job-form'
import Link from 'next/link'
import Button from 'react-bootstrap/Button'
import Alert from 'react-bootstrap/Alert'
import AccordianItem from './accordian-item'
import { useMe } from './me'
import { useRouter } from 'next/router'
import { DiscussionForm } from './discussion-form'
import { LinkForm } from './link-form'
import { PollForm } from './poll-form'
import { BountyForm } from './bounty-form'
import SubSelect from './sub-select-form'
import Info from './info'
import { useCallback, useState } from 'react'

function FreebieDialog () {
  return (
    <div className='text-center mb-4 text-muted'>
      you have no sats, so this one is on us
      <Info>
        <ul className='fw-bold'>
          <li>Free posts have limited visibility and are hidden on the recent tab until other stackers zap them.</li>
          <li>Free posts will not cover posts that cost more than 1 sat.</li>
          <li>To get fully visibile and unrestricted posts right away, fund your account with a few sats or earn some on Stacker News.</li>
        </ul>
      </Info>
    </div>
  )
}

export function PostForm ({ type, sub, children }) {
  const me = useMe()
  const [errorMessage, setErrorMessage] = useState()

  const prefix = sub?.name ? `/~${sub.name}` : ''

  const checkSession = useCallback((e) => {
    if (!me) {
      e.preventDefault()
      setErrorMessage('you must be logged in')
    }
  }, [me, setErrorMessage])

  if (!type) {
    return (
      <div className='position-relative align-items-center'>
        {errorMessage &&
          <Alert className='position-absolute' style={{ top: '-6rem' }} variant='danger' onClose={() => setErrorMessage(undefined)} dismissible>
            {errorMessage}
          </Alert>}
        {me?.sats < 1 && <FreebieDialog />}
        <SubSelect noForm sub={sub?.name} />
        <Link href={prefix + '/post?type=link'}>
          <Button variant='secondary'>link</Button>
        </Link>
        <span className='mx-3 fw-bold text-muted'>or</span>
        <Link href={prefix + '/post?type=discussion'}>
          <Button variant='secondary'>discussion</Button>
        </Link>
        <div className='d-flex mt-4'>
          <AccordianItem
            headerColor='#6c757d'
            header={<div className='fw-bold text-muted'>more types</div>}
            body={
              <div className='align-items-center'>
                <Link href={prefix + '/post?type=poll'}>
                  <Button variant='info'>poll</Button>
                </Link>
                <span className='mx-3 fw-bold text-muted'>or</span>
                <Link href={prefix + '/post?type=bounty'}>
                  <Button onClick={checkSession} variant='info'>bounty</Button>
                </Link>
                <div className='mt-3 d-flex justify-content-center'>
                  <Link href='/~jobs/post'>
                    <Button onClick={checkSession} variant='info'>job</Button>
                  </Link>
                </div>
              </div>
              }
          />
        </div>
      </div>
    )
  }

  let FormType = JobForm
  if (type === 'discussion') {
    FormType = DiscussionForm
  } else if (type === 'link') {
    FormType = LinkForm
  } else if (type === 'poll') {
    FormType = PollForm
  } else if (type === 'bounty') {
    FormType = BountyForm
  }

  return <FormType sub={sub}>{children}</FormType>
}

export default function Post ({ sub }) {
  const router = useRouter()
  let type = router.query.type

  if (sub?.postTypes?.length === 1) {
    type = sub.postTypes[0].toLowerCase()
  }

  return (
    <>
      <PostForm type={type} sub={sub}>
        {sub?.name !== 'jobs' && <SubSelect label='sub' />}
      </PostForm>
    </>
  )
}
