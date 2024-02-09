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
import SubSelect from './sub-select'
import { useCallback, useState } from 'react'
import FeeButton, { FeeButtonProvider, postCommentBaseLineItems, postCommentUseRemoteLineItems } from './fee-button'
import Delete from './delete'
import CancelButton from './cancel-button'
import { TerritoryInfo } from './territory-header'

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
    let postButtons = []
    let morePostButtons = []

    if (sub) {
      if (sub?.postTypes?.includes('LINK')) {
        postButtons.push(
          <Link key='LINK' href={prefix + '/post?type=link'}>
            <Button variant='secondary'>link</Button>
          </Link>
        )
      }

      if (sub?.postTypes?.includes('DISCUSSION')) {
        postButtons.push(
          <Link key='DISCUSSION' href={prefix + '/post?type=discussion'}>
            <Button variant='secondary'>discussion</Button>
          </Link>
        )
      }

      if (sub?.postTypes?.includes('POLL')) {
        const array = postButtons.length < 2 ? postButtons : morePostButtons
        array.push(
          <Link key='POLL' href={prefix + '/post?type=poll'}>
            <Button variant={postButtons.length < 2 ? 'secondary' : 'info'}>poll</Button>
          </Link>
        )
      }

      if (sub?.postTypes?.includes('BOUNTY')) {
        const array = postButtons.length < 2 ? postButtons : morePostButtons
        array.push(
          <Link key='BOUNTY' href={prefix + '/post?type=bounty'}>
            <Button onClick={checkSession} variant={postButtons.length < 2 ? 'secondary' : 'info'}>bounty</Button>
          </Link>
        )
      }
    } else {
      postButtons = [
        <Link key='LINK' href={prefix + '/post?type=link'}>
          <Button variant='secondary'>link</Button>
        </Link>,
        <Link key='DISCUSSION' href={prefix + '/post?type=discussion'}>
          <Button variant='secondary'>discussion</Button>
        </Link>
      ]
      morePostButtons = [
        <Link key='POLL' href={prefix + '/post?type=poll'}>
          <Button variant='info'>poll</Button>
        </Link>,
        <Link key='BOUNTY' href={prefix + '/post?type=bounty'}>
          <Button onClick={checkSession} variant='info'>bounty</Button>
        </Link>
      ]
    }

    postButtons = postButtons.reduce((acc, cur) => {
      if (acc.length) acc.push(<span key='OR-post-buttons' className='mx-3 fw-bold text-muted'>or</span>)
      acc.push(cur)
      return acc
    }, [])

    morePostButtons = morePostButtons.reduce((acc, cur) => {
      if (acc.length) acc.push(<span key='OR-more-post-buttons' className='mx-3 fw-bold text-muted'>or</span>)
      acc.push(cur)
      return acc
    }, [])

    return (
      <div className='position-relative d-flex flex-column align-items-start'>
        {errorMessage &&
          <Alert className='position-absolute' style={{ top: '-6rem' }} variant='danger' onClose={() => setErrorMessage(undefined)} dismissible>
            {errorMessage}
          </Alert>}
        <SubSelect
          prependSubs={['pick territory']}
          className='w-auto d-flex'
          noForm
          large
          sub={sub?.name}
          info={sub && <TerritoryInfo sub={sub} />}
          hint={sub?.moderated && 'this territory is moderated'}
        />
        <div>
          {postButtons}
        </div>
        <div className='d-flex mt-4'>
          <AccordianItem
            headerColor='#6c757d'
            header={<div className='fw-bold text-muted'>more types</div>}
            body={
              <div className='align-items-center'>
                {morePostButtons}
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
      baseLineItems={sub ? postCommentBaseLineItems({ baseCost: sub.baseCost, allowFreebies: sub.allowFreebies, me: !!me }) : undefined}
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
        {sub?.name !== 'jobs' &&
          <SubSelect
            sub={sub?.name}
            prependSubs={sub?.name ? undefined : ['pick territory']}
            filterSubs={s => s.postTypes?.includes(type.toUpperCase())}
            className='w-auto d-flex'
            large
            label='territory'
            info={sub && <TerritoryInfo sub={sub} />}
            hint={sub?.moderated && 'this territory is moderated'}
          />}
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
