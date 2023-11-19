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
import { useCallback, useState } from 'react'
import FeeButton, { FeeButtonProvider, postCommentBaseLineItems, postCommentUseRemoteLineItems } from './fee-button'
import Delete from './delete'
import CancelButton from './cancel-button'

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

  return (
    <FeeButtonProvider
      baseLineItems={sub ? postCommentBaseLineItems({ baseCost: sub.baseCost, me: !!me }) : undefined}
      useRemoteLineItems={postCommentUseRemoteLineItems({ me: !!me })}
    >
      <FormType sub={sub}>{children}</FormType>
    </FeeButtonProvider>
  )
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

export function ItemButtonBar ({
  itemId, canDelete = true, disable,
  className, children, onDelete, onCancel, hasCancel = true,
  createText = 'post', editText = 'save'
}) {
  const router = useRouter()

  return (
    <div className={`mt-3 ${className}`}>
      <div className='d-flex justify-content-between'>
        {itemId && canDelete &&
          <Delete
            itemId={itemId}
            onDelete={onDelete || (() => router.push(`/items/${itemId}`))}
          >
            <Button variant='grey-medium'>delete</Button>
          </Delete>}
        {children}
        <div className='d-flex align-items-center ms-auto'>
          {hasCancel && <CancelButton onClick={onCancel} />}
          <FeeButton
            text={itemId ? editText : createText}
            variant='secondary'
            disabled={disable}
          />
        </div>
      </div>
    </div>
  )
}
