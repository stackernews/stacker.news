import JobForm from './job-form'
import Link from 'next/link'
import { Button } from 'react-bootstrap'
import AccordianItem from './accordian-item'
import { useMe } from './me'
import { useRouter } from 'next/router'
import { DiscussionForm } from './discussion-form'
import { LinkForm } from './link-form'
import { PollForm } from './poll-form'
import { BountyForm } from './bounty-form'
import SubSelect from './sub-select-form'

export function PostForm ({ type, sub, children }) {
  const me = useMe()

  const prefix = sub?.name ? `/~${sub.name}` : ''

  if (!type) {
    return (
      <div className='align-items-center'>
        <SubSelect noForm sub={sub?.name} />
        {me?.freePosts && me?.sats < 1
          ? <div className='text-center font-weight-bold mb-3 text-success'>{me.freePosts} free posts left</div>
          : null}
        <Link href={prefix + '/post?type=link'}>
          <Button variant='secondary'>link</Button>
        </Link>
        <span className='mx-3 font-weight-bold text-muted'>or</span>
        <Link href={prefix + '/post?type=discussion'}>
          <Button variant='secondary'>discussion</Button>
        </Link>
        <div className='d-flex mt-3'>
          <AccordianItem
            headerColor='#6c757d'
            header={<div className='font-weight-bold text-muted'>more</div>}
            body={
              <div className='align-items-center'>
                <Link href={prefix + '/post?type=poll'}>
                  <Button variant='info'>poll</Button>
                </Link>
                <span className='mx-3 font-weight-bold text-muted'>or</span>
                <Link href={prefix + '/post?type=bounty'}>
                  <Button variant='info'>bounty</Button>
                </Link>
                <div className='mt-3 d-flex justify-content-center'>
                  <Link href='/~jobs/post'>
                    <Button variant='info'>job</Button>
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
