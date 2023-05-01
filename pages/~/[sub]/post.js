import { getGetServerSideProps } from '../../../api/ssrApollo'
import { SUB } from '../../../fragments/subs'
import LayoutCenter from '../../../components/layout-center'
import JobForm from '../../../components/job-form'
import Link from 'next/link'
import { Button } from 'react-bootstrap'
import AccordianItem from '../../../components/accordian-item'
import { useMe } from '../../../components/me'
import { useRouter } from 'next/router'
import { DiscussionForm } from '../../../components/discussion-form'
import { LinkForm } from '../../../components/link-form'
import { PollForm } from '../../../components/poll-form'
import { BountyForm } from '../../../components/bounty-form'
import { SubSelect } from '../../post'

export const getServerSideProps = getGetServerSideProps(SUB, null,
  data => !data.sub)

export function PostForm ({ type, sub }) {
  const me = useMe()

  const prefix = sub?.name ? `/~${sub.name}` : ''

  if (!type) {
    return (
      <div className='align-items-center'>
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
              </div>
              }
          />
        </div>
      </div>
    )
  }

  if (type === 'discussion') {
    return <DiscussionForm sub={sub} />
  } else if (type === 'link') {
    return <LinkForm sub={sub} />
  } else if (type === 'poll') {
    return <PollForm sub={sub} />
  } else if (type === 'bounty') {
    return <BountyForm sub={sub} />
  } else {
    return <JobForm sub={sub} />
  }
}

export default function Post ({ data: { sub } }) {
  const router = useRouter()
  let type = router.query.type

  if (sub.postTypes.length === 1) {
    type = sub.postTypes[0].toLowerCase()
  }

  return (
    <LayoutCenter sub={sub.name}>
      {sub.name !== 'jobs' && <SubSelect />}
      <PostForm type={type} sub={sub} />
    </LayoutCenter>
  )
}
