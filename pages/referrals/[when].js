import { gql } from 'graphql-tag'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { CopyInput, Select, DatePicker } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { useMe } from '@/components/me'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import { WHENS } from '@/lib/constants'
import dynamic from 'next/dynamic'
import { numWithUnits } from '@/lib/format'
import { whenToFrom } from '@/lib/time'
import { WhenComposedChartSkeleton } from '@/components/charts-skeletons'

const WhenComposedChart = dynamic(() => import('@/components/charts').then(mod => mod.WhenComposedChart), {
  loading: () => <WhenComposedChartSkeleton />
})

const REFERRALS = gql`
  query Referrals($when: String!, $from: String, $to: String)
  {
    referrals(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
  }`

export const getServerSideProps = getGetServerSideProps({ query: REFERRALS, authRequired: true })

export default function Referrals ({ ssrData }) {
  const router = useRouter()
  const { me } = useMe()

  const select = async values => {
    const { when, ...query } = values

    if (when !== 'custom') { delete query.from; delete query.to }
    if (query.from && !query.to) return

    await router.push({
      pathname: `/referrals/${when}`,
      query
    })
  }

  const { data } = useQuery(REFERRALS, { variables: { when: router.query.when, from: router.query.from, to: router.query.to } })
  if (!data && !ssrData) return <PageLoading />

  const { referrals } = data || ssrData
  const totalSats = referrals.reduce(
    (total, a) => total + a.data?.filter(d => d.name.endsWith('sats')).reduce(
      (acc, d) => acc + d.value,
      0),
    0)

  const when = router.query.when

  return (
    <CenterLayout footerLinks>
      <div className='fw-bold text-muted text-center pt-5 pb-3 d-flex align-items-center justify-content-center flex-wrap'>
        <h4 className='fw-bold text-muted text-center d-flex align-items-center justify-content-center'>
          {numWithUnits(totalSats, { abbreviate: false })} in the last
          <Select
            groupClassName='mb-0 mx-2'
            className='w-auto'
            name='when'
            size='sm'
            items={WHENS}
            value={router.query.when || 'day'}
            noForm
            onChange={(formik, e) => {
              const range = e.target.value === 'custom' ? { from: whenToFrom(when), to: Date.now() } : {}
              select({ when: e.target.value, ...range })
            }}
          />
        </h4>
        {when === 'custom' &&
          <DatePicker
            noForm
            fromName='from'
            toName='to'
            className='p-0 px-2'
            onChange={(formik, [from, to], e) => {
              select({ when, from: from.getTime(), to: to.getTime() })
            }}
            from={router.query.from}
            to={router.query.to}
            when={router.query.when}
          />}
      </div>
      <WhenComposedChart
        data={referrals}
        areaNames={['referral sats', 'one day referral sats']}
        barNames={['referrals', 'one day referrals']}
        barAxis='right'
        barStackId={1}
      />

      <div
        className='text-small pt-5 px-3 d-flex w-100 align-items-center'
      >
        <div className='nav-item text-muted pe-2' style={{ 'white-space': 'nowrap' }}>referral link:</div>
        <CopyInput
          size='sm'
          groupClassName='mb-0 w-100'
          readOnly
          noForm
          placeholder={`${process.env.NEXT_PUBLIC_URL}/r/${me.name}`}
        />
      </div>
      <ul className='py-3 text-muted'>
        <li>earn 10% of a stacker's <Link href='/rewards'>rewards</Link> in perpetuity if they sign up from your referral links</li>
        <li>in addition, earn 10% of a stacker's <Link href='/rewards'>rewards</Link> for the day if they follow your referral links the most that day</li>
        <li>nearly all sn links are referral links:
          <ul>
            <li>your profile link is an implicit referral link</li>
            <li>all links to post and comments are implicit referral links attributed to the OP</li>
            <li>links to territories are implicit referral links attributed to the territory founder</li>
          </ul>
        </li>
        <li>appending /r/{me.name} to any SN link makes it a ref link to {me.name}</li>
        <li><Link href='/invites'>invite links</Link> are also implicitly referral links</li>
      </ul>
    </CenterLayout>
  )
}
