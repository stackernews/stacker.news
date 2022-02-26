import { Checkbox, Form, Input, MarkdownInput, SubmitButton } from './form'
import TextareaAutosize from 'react-textarea-autosize'
import { InputGroup, Modal } from 'react-bootstrap'
import * as Yup from 'yup'
import { useEffect, useState } from 'react'
import Info from '../svgs/information-fill.svg'
import AccordianItem from './accordian-item'
import styles from '../styles/post.module.css'
import { useLazyQuery, gql, useMutation } from '@apollo/client'
import { useRouter } from 'next/router'
import Link from 'next/link'

Yup.addMethod(Yup.string, 'or', function (schemas, msg) {
  return this.test({
    name: 'or',
    message: msg,
    test: value => {
      if (Array.isArray(schemas) && schemas.length > 1) {
        const resee = schemas.map(schema => schema.isValidSync(value))
        return resee.some(res => res)
      } else {
        throw new TypeError('Schemas is not correct array schema')
      }
    },
    exclusive: false
  })
})

function satsMo2Min (monthly) {
  return Number.parseFloat(monthly / 30 / 24 / 60).toFixed(2)
}

// need to recent list items
export default function JobForm ({ item, sub }) {
  const storageKeyPrefix = item ? undefined : `${sub.name}-job`
  const router = useRouter()
  const [pull, setPull] = useState(satsMo2Min(item?.maxBid || sub.baseCost))
  const [info, setInfo] = useState()
  const [getAuctionPosition, { data }] = useLazyQuery(gql`
    query AuctionPosition($id: ID, $bid: Int!) {
      auctionPosition(sub: "${sub.name}", id: $id, bid: $bid)
    }`,
  { fetchPolicy: 'network-only' })
  const [upsertJob] = useMutation(gql`
    mutation upsertJob($id: ID, $title: String!, $text: String!,
      $url: String!, $maxBid: Int!, $status: String) {
      upsertJob(sub: "${sub.name}", id: $id title: $title, text: $text,
        url: $url, maxBid: $maxBid, status: $status) {
        id
      }
    }`
  )

  const JobSchema = Yup.object({
    title: Yup.string().required('required').trim(),
    text: Yup.string().required('required').trim(),
    url: Yup.string()
      .or([Yup.string().email(), Yup.string().url()], 'invalid url or email')
      .required('Required'),
    maxBid: Yup.number('must be number')
      .integer('must be integer').min(sub.baseCost, 'must be at least 10000')
      .max(100000000, 'must be less than 100000000')
      .test('multiple', 'must be a multiple of 1000 sats', (val) => val % 1000 === 0)
  })

  const position = data?.auctionPosition

  useEffect(() => {
    const initialMaxBid = Number(item?.maxBid || localStorage.getItem(storageKeyPrefix + '-maxBid')) || sub.baseCost
    getAuctionPosition({ variables: { id: item?.id, bid: initialMaxBid } })
    setPull(satsMo2Min(initialMaxBid))
  }, [])

  return (
    <>
      <Modal
        show={info}
        onHide={() => setInfo(false)}
      >
        <div className={styles.close} onClick={() => setInfo(false)}>X</div>
        <Modal.Body>
          <ol className='font-weight-bold'>
            <li>The higher your bid the higher your job will rank</li>
            <li>The minimum bid is {sub.baseCost} sats/mo</li>
            <li>You can increase or decrease your bid at anytime</li>
            <li>You can edit or remove your job at anytime</li>
            <li>Your job will be hidden if your wallet runs out of sats and can be unhidden by filling your wallet again</li>
          </ol>
          <AccordianItem
            header={<div className='font-weight-bold'>How does ranking work in detail?</div>}
            body={
              <div>
                <ol>
                  <li>You only pay as many sats/mo as required to maintain your position relative to other
                    posts and only up to your max bid.
                  </li>
                  <li>Your sats/mo must be a multiple of 1000 sats</li>
                </ol>

                <div className='font-weight-bold text-muted'>By example</div>
                <p>If your post's (A's) max bid is higher than another post (B) by at least
                  1000 sats/mo your post will rank higher and your wallet will pay 1000
                  sats/mo more than B.
                </p>
                <p>If another post (C) comes along whose max bid is higher than B's but less
                  than your's (A's), C will pay 1000 sats/mo more than B, and you will pay 1000 sats/mo
                  more than C.
                </p>
                <p>If a post (D) comes along whose max bid is higher than your's (A's), D
                  will pay 1000 stat/mo more than you (A), and the amount you (A) pays won't
                  change.
                </p>
              </div>
}
          />
        </Modal.Body>
      </Modal>
      <Form
        className='py-5'
        initial={{
          title: item?.title || '',
          text: item?.text || '',
          url: item?.url || '',
          maxBid: item?.maxBid || sub.baseCost,
          stop: false,
          start: false
        }}
        schema={JobSchema}
        storageKeyPrefix={storageKeyPrefix}
        onSubmit={(async ({ maxBid, stop, start, ...values }) => {
          let status
          if (start) {
            status = 'ACTIVE'
          } else if (stop) {
            status = 'STOPPED'
          }

          const variables = { sub: sub.name, maxBid: Number(maxBid), status, ...values }
          if (item) {
            variables.id = item.id
          }
          const { error } = await upsertJob({ variables })
          if (error) {
            throw new Error({ message: error.toString() })
          }

          if (item) {
            router.push(`/items/${item.id}`)
          } else {
            router.push(`/$${sub.name}/recent`)
          }
        })}
      >
        <Input
          label='title'
          name='title'
          required
          autoFocus
        />
        <MarkdownInput
          label='description'
          name='text'
          as={TextareaAutosize}
          minRows={6}
          required
        />
        <Input
          label={<>how to apply <small className='text-muted ml-2'>url or email address</small></>}
          name='url'
          required
        />
        <Input
          label={
            <div className='d-flex align-items-center'>max bid
              <Info width={18} height={18} className='fill-theme-color pointer ml-1' onClick={() => setInfo(true)} />
            </div>
          }
          name='maxBid'
          onChange={async (formik, e) => {
            if (e.target.value >= sub.baseCost && e.target.value <= 100000000) {
              setPull(satsMo2Min(e.target.value))
              getAuctionPosition({ variables: { id: item?.id, bid: Number(e.target.value) } })
            } else {
              setPull(satsMo2Min(sub.baseCost))
            }
          }}
          append={<InputGroup.Text className='text-monospace'>sats/month</InputGroup.Text>}
          hint={<span className='text-muted'>up to {pull} sats/min will be pulled from your wallet</span>}
        />
        <div className='font-weight-bold text-muted'>This bid puts your job in position: {position}</div>
        {item && <StatusControl item={item} />}
        <SubmitButton variant='secondary' className='mt-3'>{item ? 'save' : 'post'}</SubmitButton>
      </Form>
    </>
  )
}

function StatusControl ({ item }) {
  let StatusComp

  if (item.status === 'ACTIVE') {
    StatusComp = () => {
      return (
        <AccordianItem
          header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>I want to stop my job</div>}
          headerColor='var(--danger)'
          body={
            <Checkbox
              label={<div className='font-weight-bold text-danger'>stop my job</div>} name='stop' inline
            />
          }
        />
      )
    }
  } else if (item.status === 'STOPPED') {
    StatusComp = () => {
      return (
        <AccordianItem
          header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>I want to resume my job</div>}
          headerColor='var(--success)'
          body={
            <Checkbox
              label={<div className='font-weight-bold text-success'>resume my job</div>} name='start' inline
            />
          }
        />
      )
    }
  } else {
    StatusComp = () => {
      return (
        <div style={{ fontWeight: 'bold', color: 'var(--danger)' }}>
          you have no sats! <Link href='/wallet?type=fund' passHref><a className='text-reset text-underline'>fund your wallet</a></Link> to resume your job
        </div>
      )
    }
  }

  return (
    <div className='my-2'>
      <StatusComp />
    </div>
  )
}
