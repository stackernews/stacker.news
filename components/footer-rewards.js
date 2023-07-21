import { gql, useQuery } from '@apollo/client'
import Link from 'next/link'
import { RewardLine } from '../pages/rewards'

const REWARDS = gql`
{
  expectedRewards {
    total
  }
}`

export default function Rewards () {
  const { data } = useQuery(REWARDS, { pollInterval: 60000, nextFetchPolicy: 'cache-and-network' })
  const total = data?.expectedRewards?.total

  return (
    <Link href='/rewards' className='nav-link p-0 p-0 d-inline-flex'>
      {total ? <span><RewardLine total={total} /></span> : 'rewards'}
    </Link>
  )
}
