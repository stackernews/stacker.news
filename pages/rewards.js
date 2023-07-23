import { gql } from 'graphql-tag'
import { useEffect, useState } from 'react'
import { Button, InputGroup } from 'react-bootstrap'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getGetServerSideProps } from '../api/ssrApollo'
import { Form, Input, SubmitButton } from '../components/form'
import { CenterLayout } from '../components/layout'
import { useMutation, useQuery } from '@apollo/client'
import Link from 'next/link'
import { amountSchema } from '../lib/validate'
import Countdown from 'react-countdown'
import { abbrNum } from '../lib/format'
import PageLoading from '../components/page-loading'
import { useShowModal } from '../components/modal'

const REWARDS = gql`
{
  expectedRewards {
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
  const [threshold, setThreshold] = useState(0)

  useEffect(() => {
    setThreshold(midnight('America/Chicago'))
  }, [])

  return (
    <>
      {abbrNum(total)} sats in rewards
      {threshold &&
        <Countdown
          date={threshold}
          renderer={props => <small className='text-monospace'> {props.formatted.hours}:{props.formatted.minutes}:{props.formatted.seconds}</small>}
        />}
    </>
  )
}

export default function Rewards ({ ssrData }) {
  const { data } = useQuery(REWARDS, { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })
  if (!data && !ssrData) return <PageLoading />

  const { expectedRewards: { total, sources } } = data || ssrData

  return (
    <CenterLayout footerLinks>
      <h4 className='font-weight-bold text-muted text-center'>
        <div>
          <RewardLine total={total} />
        </div>
        <Link href='/faq#how-do-i-earn-sats-on-stacker-news' className='text-reset'>
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

const COLORS = [
  'var(--secondary)',
  'var(--info)',
  'var(--success)',
  'var(--boost)',
  'var(--grey)'
]

function GrowthPieChart ({ data }) {
  return (
    <ResponsiveContainer width='100%' height={250} minWidth={200}>
      <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <Pie
          dataKey='value'
          isAnimationActive={false}
          data={data}
          cx='50%'
          cy='50%'
          outerRadius={80}
          fill='var(--secondary)'
          label
        >
          {
            data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))
          }
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
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
            <SubmitButton variant='success' className='ml-auto mt-1 px-4' value='TIP'>donate</SubmitButton>
          </div>
        </Form>
      ))}
      >DONATE TO REWARDS
      </Button>
    </>
  )
}
