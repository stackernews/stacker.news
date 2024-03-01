import { gql } from 'graphql-tag'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { Form, Input, SubmitButton } from '../../components/form'
import Layout from '../../components/layout'
import { useMutation, useQuery } from '@apollo/client'
import Link from 'next/link'
import { amountSchema } from '../../lib/validate'
import Countdown from 'react-countdown'
import { numWithUnits } from '../../lib/format'
import PageLoading from '../../components/page-loading'
import { useShowModal } from '../../components/modal'
import dynamic from 'next/dynamic'
import { SSR } from '../../lib/constants'
import { useToast } from '../../components/toast'
import { useLightning } from '../../components/lightning'
import { ListUsers } from '../../components/user-list'
import { Col, Row } from 'react-bootstrap'
import { proportions } from '../../lib/madness'

const GrowthPieChart = dynamic(() => import('../../components/charts').then(mod => mod.GrowthPieChart), {
  loading: () => <div>Loading...</div>
})

const REWARDS = gql`
{
  rewards {
    total
    time
    sources {
      name
      value
    }
  }
  topUsers(when: "custom", from: "1706767200000", to: "1709272799999", by: "value", limit: 64) {
    users {
      id
      name
      photoId
      ncomments(when: "custom", from: "1706767200000", to: "1709272799999")
      nposts(when: "custom", from: "1706767200000", to: "1709272799999")

      optional {
        streak
        stacked(when: "custom", from: "1706767200000", to: "1709272799999")
        spent(when: "custom", from: "1706767200000", to: "1709272799999")
        referrals(when: "custom", from: "1706767200000", to: "1709272799999")
      }
    }
    cursor
  }
}
`

function tzOffset (tz) {
  const date = new Date()
  date.setMilliseconds(0)
  const targetDate = new Date(date.toLocaleString('en-US', { timeZone: tz }))
  const targetOffsetHours = (date.getTime() - targetDate.getTime()) / 1000 / 60 / 60
  return targetOffsetHours
}

export function midnight (tz) {
  const date = new Date()
  date.setHours(24, 0, 0, 0)
  return date.getTime() + tzOffset(tz) * 60 * 60 * 1000
}

export const getServerSideProps = getGetServerSideProps({ query: REWARDS })

export function RewardLine ({ total, time }) {
  return (
    <>
      <span tyle={{ whiteSpace: 'nowrap' }}>
        {numWithUnits(total)} in rewards
      </span>
      {time &&
        <Countdown
          date={time}
          renderer={props =>
            <small className='text-monospace' suppressHydrationWarning style={{ whiteSpace: 'nowrap' }}>
              {props.formatted.days
                ? ` ${props.formatted.days}d ${props.formatted.hours}h ${props.formatted.minutes}m ${props.formatted.seconds}s`
                : ` ${props.formatted.hours}:${props.formatted.minutes}:${props.formatted.seconds}`}
            </small>}
        />}
    </>
  )
}

export default function Rewards ({ ssrData }) {
  const { data } = useQuery(REWARDS, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })
  if (!data && !ssrData) return <PageLoading />

  const { rewards: [{ total, sources, time }], topUsers } = data || ssrData

  function EstimatedReward ({ rank }) {
    return (
      <div className='text-muted fst-italic'>
        <small>
          <span>estimated reward: {numWithUnits(Math.floor(total * proportions[rank - 1]))}</span>
        </small>
      </div>
    )
  }

  return (
    <Layout footerLinks>
      <Row className='py-3'>
        <Col>
          <div
            className='d-flex flex-column sticky-lg-top py-5'
          >
            <h3 className='text-center'>
              <div>
                <RewardLine total={total} time={time} />
              </div>
              <Link href='/faq#how-do-i-earn-sats-on-stacker-news' className='text-info fw-normal'>
                <small><small><small>learn about rewards</small></small></small>
              </Link>
            </h3>
            <div className='my-3 w-100'>
              <GrowthPieChart data={sources} />
            </div>
            <DonateButton />
          </div>
        </Col>
        {topUsers &&
          <Col lg={7}>
            <h2 className='pt-5 text-center'>leaderboard</h2>
            <div className='d-flex justify-content-center pt-4'>
              <ListUsers users={topUsers.users} rank Embellish={EstimatedReward} />
            </div>
          </Col>}
      </Row>
    </Layout>
  )
}

export function DonateButton () {
  const showModal = useShowModal()
  const toaster = useToast()
  const strike = useLightning()
  const [donateToRewards] = useMutation(
    gql`
      mutation donateToRewards($sats: Int!, $hash: String, $hmac: String) {
        donateToRewards(sats: $sats, hash: $hash, hmac: $hmac)
      }`)

  return (
    <>
      <Button
        onClick={() => showModal(onClose => (
          <Form
            initial={{
              amount: 10000
            }}
            schema={amountSchema}
            invoiceable
            onSubmit={async ({ amount, hash, hmac }) => {
              const { error } = await donateToRewards({
                variables: {
                  sats: Number(amount),
                  hash,
                  hmac
                }
              })
              if (error) {
                console.error(error)
                toaster.danger('failed to donate')
              } else {
                const didStrike = strike()
                if (!didStrike) {
                  toaster.success('donated')
                }
              }
              onClose()
            }}
          >
            <Input
              label='amount'
              name='amount'
              type='number'
              required
              autoFocus
              append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
            />
            <div className='d-flex'>
              <SubmitButton variant='success' className='ms-auto mt-1 px-4' value='TIP'>donate</SubmitButton>
            </div>
          </Form>
        ))}
        className='align-self-center'
      >DONATE TO REWARDS
      </Button>
    </>
  )
}
