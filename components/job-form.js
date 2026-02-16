import { Checkbox, Form, Input, SNInput, SubmitButton } from './form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Image from 'react-bootstrap/Image'
import { useState } from 'react'
import styles from '@/styles/post.module.css'
import Avatar from './avatar'
import { jobSchema } from '@/lib/validate'
import { MAX_TITLE_LENGTH, MEDIA_URL } from '@/lib/constants'
import { UPSERT_JOB } from '@/fragments/payIn'
import useItemSubmit from './use-item-submit'
import FeeButton from './fee-button'
import CancelButton from './cancel-button'

// need to recent list items
export default function JobForm ({ item, subs }) {
  const storageKeyPrefix = item ? undefined : 'job'
  const [logoId, setLogoId] = useState(item?.uploadId)

  const extraValues = logoId ? { logo: Number(logoId) } : {}
  const onSubmit = useItemSubmit(UPSERT_JOB, { item, sub: subs[0], extraValues })

  return (
    <>
      <Form
        className='pb-5 pt-3'
        initial={{
          title: item?.title || '',
          company: item?.company || '',
          location: item?.location || '',
          remote: item?.remote || false,
          text: item?.text || '',
          url: item?.url || '',
          stop: false,
          start: false
        }}
        schema={jobSchema({})}
        storageKeyPrefix={storageKeyPrefix}
        requireSession
        onSubmit={onSubmit}
      >
        <div className='form-group'>
          <label className='form-label'>logo</label>
          <div className='position-relative' style={{ width: 'fit-content' }}>
            <Image
              src={logoId ? `${MEDIA_URL}/${logoId}` : '/jobs-default.png'} width='135' height='135' roundedCircle
            />
            <Avatar onSuccess={setLogoId} />
          </div>
        </div>
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
        <Row className='me-0'>
          <Col>
            <Input
              label='location'
              name='location'
              clear
            />
          </Col>
          <Col className='d-flex ps-0' xs='auto'>
            <Checkbox
              label={<div className='fw-bold'>remote</div>} name='remote' hiddenLabel
              groupClassName={styles.inlineCheckGroup}
            />
          </Col>
        </Row>
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
    <div className={`mt-3 ${className}`}>
      <div className='d-flex justify-content-between'>
        {itemId && !isStopped &&
          <SubmitButton valueName='status' value='STOPPED' variant='grey-medium'>{resolvedStopText}</SubmitButton>}
        {children}
        <div className='d-flex align-items-center ms-auto'>
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
