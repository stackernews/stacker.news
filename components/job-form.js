import { Checkbox, Form, FormGroup, Input, SNInput, SubmitButton } from './form'
import { useState } from 'react'
import styles from '@/styles/post.module.css'
import Avatar from './avatar'
import { jobSchema } from '@/lib/validate'
import { MAX_TITLE_LENGTH, MEDIA_URL } from '@/lib/constants'
import { UPSERT_JOB } from '@/fragments/payIn'
import useItemSubmit from './use-item-submit'
import FeeButton from './fee-button'
import CancelButton from './cancel-button'
import { useApolloClient } from '@apollo/client/react'

// need to recent list items
export default function JobForm ({ item }) {
  const client = useApolloClient()
  const storageKeyPrefix = item ? undefined : 'job'
  const [logoId, setLogoId] = useState(item?.uploadId)

  const extraValues = logoId ? { logo: Number(logoId) } : {}
  const onSubmit = useItemSubmit(UPSERT_JOB, { item, extraValues })

  return (
    <>
      <Form
        className='pb-12 pt-4'
        initial={{
          subNames: item?.subNames || ['jobs'],
          title: item?.title || '',
          company: item?.company || '',
          location: item?.location || '',
          remote: item?.remote || false,
          text: item?.text || '',
          url: item?.url || '',
          stop: false,
          start: false
        }}
        schema={jobSchema({ client })}
        storageKeyPrefix={storageKeyPrefix}
        requireSession
        onSubmit={onSubmit}
      >
        <FormGroup label='logo'>
          <div className='relative w-fit'>
            <img
              src={logoId ? `${MEDIA_URL}/${logoId}` : '/jobs-default.png'} width='135' height='135' className='rounded-full'
            />
            <Avatar onSuccess={setLogoId} />
          </div>
        </FormGroup>
        <Input
          label='job title'
          name='title'
          required
          autoFocus
          clear
          maxLength={MAX_TITLE_LENGTH}
        />
        <Input
          label='company'
          name='company'
          required
          clear
        />
        <div className='flex gap-4'>
          <div className='grow basis-0'>
            <Input
              label='location'
              name='location'
              clear
            />
          </div>
          <div className='flex'>
            <Checkbox
              label={<div className='font-bold'>remote</div>} name='remote' hiddenLabel
              groupClassName={styles.inlineCheckGroup}
            />
          </div>
        </div>
        <SNInput
          topLevel
          label='description'
          name='text'
          minRows={6}
          required
        />
        <Input
          label={<>how to apply <small className='text-muted ms-2'>url or email address</small></>}
          name='url'
          required
          clear
        />
        <JobButtonBar itemId={item?.id} status={item?.status} />
      </Form>
    </>
  )
}

export function JobButtonBar ({
  itemId, status, disable, className, children, handleStop, onCancel, hasCancel = true,
  createText = 'post', editText, stopText
}) {
  const isStopped = status === 'STOPPED'
  const resolvedEditText = editText ?? (isStopped ? 'resume job' : 'save')
  const resolvedStopText = stopText ?? 'stop job'

  return (
    <div className={`mt-4 ${className}`}>
      <div className='flex justify-between'>
        {itemId && !isStopped &&
          <SubmitButton valueName='status' value='STOPPED' variant='grey-medium'>{resolvedStopText}</SubmitButton>}
        {children}
        <div className='flex items-center ms-auto'>
          {hasCancel && <CancelButton onClick={onCancel} />}
          <FeeButton
            text={itemId ? resolvedEditText : createText}
            variant='secondary'
            disabled={disable}
          />
        </div>
      </div>
    </div>
  )
}
