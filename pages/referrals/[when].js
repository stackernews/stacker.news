import { gql } from 'graphql-tag'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { CopyInput, Select } from '../../components/form'
import { CenterLayout } from '../../components/layout'
import { useMe } from '../../components/me'
import { useQuery } from '@apollo/client'
import PageLoading from '../../components/page-loading'
import { WHENS } from '../../lib/constants'
import dynamic from 'next/dynamic'
import { numWithUnits } from '../../lib/format'

const WhenComposedChart = dynamic(() => import('../../components/charts').then(mod => mod.WhenComposedChart), {
  loading: () => <div>Loading...</div>
})

const REFERRALS = gql`
  query Referrals($when: String!)
  {
    referrals(when: $when) {
      totalSats
      totalReferrals
      stats {
        time
        data {
          name
          value
        }
      }
    }
  }`

export const getServerSideProps = getGetServerSideProps(REFERRALS)

export default function Referrals ({ ssrData }) {
  const router = useRouter()
  const me = useMe()

  const { data } = useQuery(REFERRALS, { variables: { when: router.query.when } })
  if (!data && !ssrData) return <PageLoading />

  const { referrals: { totalSats, totalReferrals, stats } } = data || ssrData

  return (
    <CenterLayout footerLinks>
      <h4 className='fw-bold text-muted text-center pt-5 pb-3 d-flex align-items-center justify-content-center'>
        {numWithUnits(totalReferrals, { unitPlural: 'referrals', unitSingular: 'referral' })} & {numWithUnits(totalSats, { abbreviate: false })} in the last
        <Select
          groupClassName='mb-0 ms-2'
          className='w-auto'
          name='when'
          size='sm'
          items={WHENS}
          value={router.query.when || 'day'}
          noForm
          onChange={(formik, e) => router.push(`/referrals/${e.target.value}`)}
        />
      </h4>
      <WhenComposedChart data={stats} lineNames={['sats']} barNames={['referrals']} barAxis='right' />

      <div
        className='text-small pt-5 px-3 d-flex w-100 align-items-center'
      >
        <div className='nav-item text-muted pe-2' style={{ 'white-space': 'nowrap' }}>referral link:</div>
        <CopyInput
          size='sm'
          groupClassName='mb-0 w-100'
          readOnly
          noForm
          placeholder={`https://stacker.news/r/${me.name}`}
        />
      </div>
      <ul className='py-3 text-muted'>
        <li>{`appending /r/${me.name} to any SN link makes it a ref link`}
          <ul>
            <li>e.g. https://stacker.news/items/1/r/{me.name}</li>
          </ul>
        </li>
        <li>earn 21% of boost and job fees spent by referred stackers</li>
        <li>earn 2.1% of all zaps received by referred stackers</li>
        <li><Link href='/invites'>invite links</Link> are also implicitly referral links</li>
      </ul>
    </CenterLayout>
  )
}
