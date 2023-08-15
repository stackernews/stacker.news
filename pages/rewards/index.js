import { gql } from 'graphql-tag'
import { useMemo } from 'react'
import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { Form, Input, SubmitButton } from '../../components/form'
import { CenterLayout } from '../../components/layout'
import { useMutation, useQuery } from '@apollo/client'
import Link from 'next/link'
import { amountSchema } from '../../lib/validate'
import Countdown from 'react-countdown'
import { numWithUnits } from '../../lib/format'
import PageLoading from '../../components/page-loading'
import { useShowModal } from '../../components/modal'
import dynamic from 'next/dynamic'
import { SSR } from '../../lib/constants'

const GrowthPieChart = dynamic(() => import('../../components/charts').then(mod => mod.GrowthPieChart), {
  loading: () => <div>Loading...</div>
})

const REWARDS = gql`
{
  rewards {
    total
    sources {
      name
      value
    }
  }
}
`

function midnight (tz) {
  function tzOffset (tz) {
    const date = new Date()
    date.setMilliseconds(0)
    const targetDate = new Date(date.toLocaleString('en-US', { timeZone: tz }))
    const targetOffsetHours = (date.getTime() - targetDate.getTime()) / 1000 / 60 / 60
    return targetOffsetHours
  }

  const date = new Date()
  date.setHours(24, 0, 0, 0)
  return date.getTime() + tzOffset(tz) * 60 * 60 * 1000
}

export const getServerSideProps = getGetServerSideProps(REWARDS)

export function RewardLine ({ total }) {
  const threshold = useMemo(() => midnight('America/Chicago'))

  return (
    <>
      {numWithUnits(total)} in rewards
      {threshold &&
        <Countdown
          date={threshold}
          renderer={props => <small className='text-monospace' suppressHydrationWarning> {props.formatted.hours}:{props.formatted.minutes}:{props.formatted.seconds}</small>}
        />}
    </>
  )
}

export default function Rewards ({ ssrData }) {
  const { data } = useQuery(REWARDS, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })
  if (!data && !ssrData) return <PageLoading />

  const { rewards: { total, sources } } = data || ssrData

  return (
    <CenterLayout footerLinks>
      <h4 className='fw-bold text-muted text-center'>
        <div>
          <RewardLine total={total} />
        </div>
        <Link href='/faq#how-do-i-earn-sats-on-stacker-news' className='text-info fw-normal'>
          <small><small><small>learn about rewards</small></small></small>
        </Link>
      </h4>
      <div className='my-3 w-100'>
        <GrowthPieChart data={sources} />
      </div>
      <DonateButton />
    </CenterLayout>
  )
}

export function DonateButton () {
  const showModal = useShowModal()
  const [donateToRewards] = useMutation(
    gql`
      mutation donateToRewards($sats: Int!) {
        donateToRewards(sats: $sats)
      }`)

  return (
    <>
      <Button onClick={() => showModal(onClose => (
        <Form
          initial={{
            amount: 1000
          }}
          schema={amountSchema}
          onSubmit={async ({ amount }) => {
            await donateToRewards({
              variables: {
                sats: Number(amount)
              }
            })
            onClose()
          }}
        >
          <Input
            label='amount'
            name='amount'
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <div className='d-flex'>
            <SubmitButton variant='success' className='ms-auto mt-1 px-4' value='TIP'>donate</SubmitButton>
          </div>
        </Form>
      ))}
      >DONATE TO REWARDS
      </Button>
    </>
  )
}
