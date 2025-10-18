import { Checkbox, Form, Input, SubmitButton, LexicalInput } from './form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Image from 'react-bootstrap/Image'
import { useEffect, useState } from 'react'
import Info from './info'
import styles from '@/styles/post.module.css'
import { useLazyQuery, gql } from '@apollo/client'
import Avatar from './avatar'
import { jobSchema } from '@/lib/validate'
import { BOOST_MIN, BOOST_MULT, MAX_TITLE_LENGTH, MEDIA_URL } from '@/lib/constants'
import { UPSERT_JOB } from '@/fragments/paidAction'
import useItemSubmit from './use-item-submit'
import { BoostInput } from './adv-post-form'
import { numWithUnits, giveOrdinalSuffix } from '@/lib/format'
import useDebounceCallback from './use-debounce-callback'
import FeeButton from './fee-button'
import CancelButton from './cancel-button'

// need to recent list items
export default function JobForm ({ item, sub }) {
  const storageKeyPrefix = item ? undefined : `${sub.name}-job`
  const [logoId, setLogoId] = useState(item?.uploadId)

  const [getAuctionPosition, { data }] = useLazyQuery(gql`
     query AuctionPosition($id: ID, $boost: Int) {
       auctionPosition(sub: "${item?.subName || sub?.name}", id: $id, boost: $boost)
     }`,
  { fetchPolicy: 'cache-and-network' })

  const getPositionDebounce = useDebounceCallback((...args) => getAuctionPosition(...args), 1000, [getAuctionPosition])

  useEffect(() => {
    if (item?.boost) {
      getPositionDebounce({ variables: { boost: item.boost, id: item.id } })
    }
  }, [item?.boost])

  const extraValues = logoId ? { logo: Number(logoId) } : {}
  const onSubmit = useItemSubmit(UPSERT_JOB, { item, sub, extraValues })

  return (
    <>
      <Form
        className='pb-5 pt-3'
        initial={{
          title: item?.title || '',
          company: item?.company || '',
          location: item?.location || '',
          remote: item?.remote || false,
          boost: item?.boost || '',
          text: item?.text || '',
          lexicalState: item?.lexicalState || '',
          url: item?.url || '',
          stop: false,
          start: false
        }}
        schema={jobSchema({ existingBoost: item?.boost })}
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
        <LexicalInput label='description' name='text' topLevel />
        {/* <MarkdownInput
          topLevel
          label='description'
          name='text'
          minRows={6}
          required
        /> */}
        <Input
          label={<>how to apply <small className='text-muted ms-2'>url or email address</small></>}
          name='url'
          required
          clear
        />
        <BoostInput
          label={
            <div className='d-flex align-items-center'>boost
              <Info>
                <ol>
                  <li>Boost ranks jobs higher based on the amount</li>
                  <li>The minimum boost is {numWithUnits(BOOST_MIN, { abbreviate: false })}</li>
                  <li>Boost must be divisible by {numWithUnits(BOOST_MULT, { abbreviate: false })}</li>
                  <li>100% of boost goes to the territory founder and top stackers as rewards</li>
                </ol>
              </Info>
            </div>
          }
          hint={<span className='text-muted'>{data?.auctionPosition ? `your job will rank ${giveOrdinalSuffix(data.auctionPosition)}` : 'higher boost ranks your job higher'}</span>}
          onChange={(_, e) => getPositionDebounce({ variables: { boost: Number(e.target.value), id: item?.id } })}
        />
        <JobButtonBar itemId={item?.id} />
      </Form>
    </>
  )
}

export function JobButtonBar ({
  itemId, disable, className, children, handleStop, onCancel, hasCancel = true,
  createText = 'post', editText = 'save', stopText = 'remove'
}) {
  return (
    <div className={`mt-3 ${className}`}>
      <div className='d-flex justify-content-between'>
        {itemId &&
          <SubmitButton valueName='status' value='STOPPED' variant='grey-medium'>{stopText}</SubmitButton>}
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
