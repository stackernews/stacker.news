import JobForm from './job-form'
import Link from 'next/link'
import Button, { buttonClasses } from '@/components/ui/button'
import Alert from '@/components/ui/alert'
import AccordianItem from './accordian-item'
import { useMe } from './me'
import { useRouter } from 'next/router'
import { DiscussionForm } from './discussion-form'
import { LinkForm } from './link-form'
import { PollForm } from './poll-form'
import { BountyForm } from './bounty-form'
import { SubMultiSelect } from './sub-select'
import { useCallback, useState } from 'react'
import FeeButton, { FeeButtonProvider, postCommentBaseLineItems, postCommentUseRemoteLineItems } from './fee-button'
import Delete from './delete'
import CancelButton from './cancel-button'
import { subNames, subsPostPrefix, subsAllSupport } from '@/lib/subs'

export function PostForm ({ type, subs, children }) {
  const { me } = useMe()
  const [errorMessage, setErrorMessage] = useState()

  const prefix = subsPostPrefix(subs)

  const checkSession = useCallback((e) => {
    if (!me) {
      e.preventDefault()
      setErrorMessage('you must be logged in')
    }
  }, [me, setErrorMessage])

  if (!type) {
    let postButtons = []
    let morePostButtons = []

    if (subs.length) {
      if (subsAllSupport(subs, 'LINK')) {
        postButtons.push(
          <Link key='LINK' href={prefix + '/post?type=link'} className={buttonClasses({ variant: 'secondary' })}>
            link
          </Link>
        )
      }

      if (subsAllSupport(subs, 'DISCUSSION')) {
        postButtons.push(
          <Link key='DISCUSSION' href={prefix + '/post?type=discussion'} className={buttonClasses({ variant: 'secondary' })}>
            discussion
          </Link>
        )
      }

      if (subsAllSupport(subs, 'POLL')) {
        const array = postButtons.length < 2 ? postButtons : morePostButtons
        array.push(
          <Link key='POLL' href={prefix + '/post?type=poll'} className={buttonClasses({ variant: postButtons.length < 2 ? 'secondary' : 'info' })}>
            poll
          </Link>
        )
      }

      if (subsAllSupport(subs, 'BOUNTY')) {
        const array = postButtons.length < 2 ? postButtons : morePostButtons
        array.push(
          <Link key='BOUNTY' href={prefix + '/post?type=bounty'} onClick={checkSession} className={buttonClasses({ variant: postButtons.length < 2 ? 'secondary' : 'info' })}>
            bounty
          </Link>
        )
      }
    } else {
      postButtons = [
        <Link key='LINK' href={prefix + '/post?type=link'} className={buttonClasses({ variant: 'secondary' })}>
          link
        </Link>,
        <Link key='DISCUSSION' href={prefix + '/post?type=discussion'} className={buttonClasses({ variant: 'secondary' })}>
          discussion
        </Link>
      ]
      morePostButtons = [
        <Link key='POLL' href={prefix + '/post?type=poll'} className={buttonClasses({ variant: 'info' })}>
          poll
        </Link>,
        <Link key='BOUNTY' href={prefix + '/post?type=bounty'} onClick={checkSession} className={buttonClasses({ variant: 'info' })}>
          bounty
        </Link>
      ]
    }

    postButtons = postButtons.reduce((acc, cur) => {
      if (acc.length) acc.push(<span key='OR-post-buttons' className='mx-4 font-bold text-muted'>or</span>)
      acc.push(cur)
      return acc
    }, [])

    morePostButtons = morePostButtons.reduce((acc, cur) => {
      if (acc.length) acc.push(<span key='OR-more-post-buttons' className='mx-4 font-bold text-muted'>or</span>)
      acc.push(cur)
      return acc
    }, [])

    return (
      <div className='relative flex flex-col items-start'>
        {errorMessage &&
          <Alert className='absolute' style={{ top: '-6rem' }} variant='danger' onClose={() => setErrorMessage(undefined)} dismissible>
            {errorMessage}
          </Alert>}
        {subs.length > 0 && (
          <SubMultiSelect
            placeholder='pick territories'
            className='flex'
            noForm
            size='medium'
            subs={subNames(subs)}
          />
        )}
        <div>
          {postButtons}
        </div>
        <div className='flex mt-6'>
          <AccordianItem
            headerColor='#6c757d'
            header={<div className='font-bold text-muted'>more types</div>}
            body={
              <div className='items-center'>
                {morePostButtons}
                <div className='mt-4 flex justify-center'>
                  <Link href='/~jobs/post' onClick={checkSession} className={buttonClasses({ variant: 'info' })}>
                    job
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
      baseLineItems={postCommentBaseLineItems({ subs, me: !!me })}
      useRemoteLineItems={postCommentUseRemoteLineItems()}
    >
      <FormType subs={subs}>{children}</FormType>
    </FeeButtonProvider>
  )
}

export default function Post ({ subs }) {
  const router = useRouter()
  let type = router.query.type

  if (subs.length === 1 && subs[0].postTypes?.length === 1) {
    type = subs[0].postTypes[0].toLowerCase()
  }

  return (
    <>
      <PostForm type={type} subs={subs}>
        <SubMultiSelect
          subs={subNames(subs)}
          placeholder='pick territories'
          filterSubs={s => s.postTypes?.includes(type.toUpperCase())}
          className='flex'
          size='medium'
          label='territory'
        />
      </PostForm>
    </>
  )
}

export function ItemButtonBar ({
  itemId, canDelete = true, disable,
  className, children, onDelete, onCancel, hasCancel = true,
  createText = 'post', editText = 'save', deleteText = 'delete'
}) {
  const router = useRouter()

  return (
    <div className={`mt-4 ${className}`}>
      <div className='flex justify-between'>
        {itemId && canDelete &&
          <Delete
            itemId={itemId}
            onDelete={onDelete || (() => router.push(`/items/${itemId}`))}
          >
            <Button variant='grey-medium'>{deleteText}</Button>
          </Delete>}
        {children}
        <div className='flex items-center ms-auto'>
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
