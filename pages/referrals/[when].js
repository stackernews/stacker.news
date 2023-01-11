import { gql } from 'apollo-server-micro'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { CopyInput, Form, Select } from '../../components/form'
import LayoutCenter from '../../components/layout-center'
import { useMe } from '../../components/me'
import { WhenComposedChart } from '../../components/when-charts'

export const getServerSideProps = getGetServerSideProps(
  gql`
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
    }`)

export default function Referrals ({ data: { referrals: { totalSats, totalReferrals, stats } } }) {
  const router = useRouter()
  const me = useMe()
  return (
    <LayoutCenter footerLinks>
      <Form
        initial={{
          when: router.query.when
        }}
      >
        <h4 className='font-weight-bold text-muted text-center pt-5 pb-3 d-flex align-items-center justify-content-center'>
          {totalReferrals} referrals & {totalSats} sats in the last
          <Select
            groupClassName='mb-0 ml-2'
            className='w-auto'
            name='when'
            size='sm'
            items={['day', 'week', 'month', 'year', 'forever']}
            onChange={(formik, e) => router.push(`/referrals/${e.target.value}`)}
          />
        </h4>
      </Form>
      <WhenComposedChart data={stats} lineNames={['sats']} barNames={['referrals']} />

      <div
        className='text-small pt-5 px-3 d-flex w-100 align-items-center'
      >
        <div className='nav-item text-muted pr-2' style={{ 'white-space': 'nowrap' }}>referral link:</div>
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
        <li>earn 2.1% of all tips received by referred stackers</li>
        <li><Link href='/invites' passHref><a>invite links</a></Link> are also implicitly referral links</li>
      </ul>
    </LayoutCenter>
  )
}
