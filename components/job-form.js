import { Checkbox, Form, Input, MarkdownInput } from './form'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import InputGroup from 'react-bootstrap/InputGroup'
import Image from 'react-bootstrap/Image'
import BootstrapForm from 'react-bootstrap/Form'
import Alert from 'react-bootstrap/Alert'
import { useEffect, useState } from 'react'
import Info from './info'
import AccordianItem from './accordian-item'
import styles from '@/styles/post.module.css'
import { useLazyQuery, gql } from '@apollo/client'
import Link from 'next/link'
import { usePrice } from './price'
import Avatar from './avatar'
import { jobSchema } from '@/lib/validate'
import { MAX_TITLE_LENGTH, MEDIA_URL } from '@/lib/constants'
import { ItemButtonBar } from './post'
import { useFormikContext } from 'formik'
import { UPSERT_JOB } from '@/fragments/paidAction'
import useItemSubmit from './use-item-submit'

function satsMin2Mo (minute) {
  return minute * 30 * 24 * 60
}

function PriceHint ({ monthly }) {
  const { price, fiatSymbol } = usePrice()

  if (!price || !monthly) {
    return null
  }
  const fixed = (n, f) => Number.parseFloat(n).toFixed(f)
  const fiat = fixed((price / 100000000) * monthly, 0)

  return <span className='text-muted'>{monthly} sats/mo which is {fiatSymbol}{fiat}/mo</span>
}

// need to recent list items
export default function JobForm ({ item, sub }) {
  const storageKeyPrefix = item ? undefined : `${sub.name}-job`
  const [logoId, setLogoId] = useState(item?.uploadId)

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
          text: item?.text || '',
          url: item?.url || '',
          maxBid: item?.maxBid || 0,
          stop: false,
          start: false
        }}
        schema={jobSchema}
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
        <MarkdownInput
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
        <PromoteJob item={item} sub={sub} />
        {item && <StatusControl item={item} />}
        <ItemButtonBar itemId={item?.id} canDelete={false} />
      </Form>
    </>
  )
}

const FormStatus = {
  DIRTY: 'dirty',
  ERROR: 'error'
}

function PromoteJob ({ item, sub }) {
  const formik = useFormikContext()
  const [show, setShow] = useState(false)
  const [monthly, setMonthly] = useState(satsMin2Mo(item?.maxBid || 0))
  const [getAuctionPosition, { data }] = useLazyQuery(gql`
    query AuctionPosition($id: ID, $bid: Int!) {
      auctionPosition(sub: "${item?.subName || sub?.name}", id: $id, bid: $bid)
    }`,
  { fetchPolicy: 'cache-and-network' })
  const position = data?.auctionPosition

  useEffect(() => {
    const initialMaxBid = Number(item?.maxBid) || 0
    getAuctionPosition({ variables: { id: item?.id, bid: initialMaxBid } })
    setMonthly(satsMin2Mo(initialMaxBid))
  }, [])

  useEffect(() => {
    if (formik?.values?.maxBid !== 0) {
      setShow(FormStatus.DIRTY)
    }
  }, [formik?.values])

  useEffect(() => {
    const hasMaxBidError = !!formik?.errors?.maxBid
    // if it's open we don't want to collapse on submit
    setShow(show => show || (hasMaxBidError && formik?.isSubmitting && FormStatus.ERROR))
  }, [formik?.isSubmitting])

  return (
    <AccordianItem
      show={show}
      header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>promote</div>}
      body={
        <>
          <Input
            label={
              <div className='d-flex align-items-center'>bid
                <Info>
                  <ol>
                    <li>The higher your bid the higher your job will rank</li>
                    <li>You can increase, decrease, or remove your bid at anytime</li>
                    <li>You can edit or stop your job at anytime</li>
                    <li>If you run out of sats, your job will stop being promoted until you fill your wallet again</li>
                  </ol>
                </Info>
                <small className='text-muted ms-2'>optional</small>
              </div>
          }
            name='maxBid'
            onChange={async (formik, e) => {
              if (e.target.value >= 0 && e.target.value <= 100000000) {
                setMonthly(satsMin2Mo(e.target.value))
                getAuctionPosition({ variables: { id: item?.id, bid: Number(e.target.value) } })
              } else {
                setMonthly(satsMin2Mo(0))
              }
            }}
            append={<InputGroup.Text className='text-monospace'>sats/min</InputGroup.Text>}
            hint={<PriceHint monthly={monthly} />}
          />
          <><div className='fw-bold text-muted'>This bid puts your job in position: {position}</div></>
        </>
  }
    />
  )
}

function StatusControl ({ item }) {
  let StatusComp

  if (item.status !== 'STOPPED') {
    StatusComp = () => {
      return (
        <>

          <AccordianItem
            header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>I want to stop my job</div>}
            headerColor='var(--bs-danger)'
            body={
              <Checkbox
                label={<div className='fw-bold text-danger'>stop my job</div>} name='stop' inline
              />
          }
          />
        </>
      )
    }
  } else if (item.status === 'STOPPED') {
    StatusComp = () => {
      return (
        <AccordianItem
          header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>I want to resume my job</div>}
          headerColor='var(--bs-success)'
          body={
            <Checkbox
              label={<div className='fw-bold text-success'>resume my job</div>} name='start' inline
            />
          }
        />
      )
    }
  }

  return (
    <div className='my-3 border border-3 rounded'>
      <div className='p-3'>
        <BootstrapForm.Label>job control</BootstrapForm.Label>
        {item.status === 'NOSATS' &&
          <Alert variant='warning'>your promotion ran out of sats. <Link href='/wallet?type=fund' className='text-reset text-underline'>fund your wallet</Link> or reduce bid to continue promoting your job</Alert>}
        <StatusComp />
      </div>
    </div>
  )
}
