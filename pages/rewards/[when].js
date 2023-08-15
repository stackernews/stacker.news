import { useQuery } from '@apollo/client'
import PageLoading from '../../components/page-loading'
import { ME_REWARDS } from '../../fragments/rewards'
import { CenterLayout } from '../../components/layout'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { fixedDecimal } from '../../lib/format'
import Trophy from '../../svgs/trophy-fill.svg'

const GrowthPieChart = dynamic(() => import('../../components/charts').then(mod => mod.GrowthPieChart), {
  loading: () => <div>Loading...</div>
})

export const getServerSideProps = getGetServerSideProps(ME_REWARDS, null,
  (data, params) => data.rewards.total === 0 || new Date(data.rewards.time) > new Date())

const timeString = when => new Date(when).toISOString().slice(0, 10)

export default function Rewards ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(ME_REWARDS, { variables: { ...router.query } })
  if (!data && !ssrData) return <PageLoading />

  const { rewards: { total, sources, time }, meRewards } = data || ssrData
  const when = router.query.when

  return (
    <CenterLayout footerLinks>
      <div className='py-3'>
        <h4 className='fw-bold text-muted ps-0'>
          {when && <div className='text-muted fst-italic fs-6 fw-normal pb-1'>On {timeString(time)} at 12a CT</div>}
          {total} sats were rewarded
        </h4>
        <div className='my-3 w-100'>
          <GrowthPieChart data={sources} />
        </div>
        {meRewards &&
          <>
            <h4 className='fw-bold text-muted text-center'>
              you earned {meRewards.total} sats ({fixedDecimal(meRewards.total * 100 / total, 2)}%)
            </h4>
            <div>
              {meRewards.rewards?.map((r, i) => <Reward key={[r.rank, r.type].join('-')} {...r} />)}
            </div>
          </>}
      </div>
    </CenterLayout>
  )
}

function Reward ({ rank, type, sats }) {
  if (!rank) return null

  const color = rank <= 3 ? 'text-primary' : 'text-muted'

  let category = type
  switch (type) {
    case 'TIP_POST':
      category = 'in post zapping'
      break
    case 'TIP_COMMENT':
      category = 'in comment zapping'
      break
    case 'POST':
      category = 'among posts'
      break
    case 'COMMENT':
      category = 'among comments'
      break
  }

  return (
    <div className={color}>
      <Trophy height={20} width={20} /> <b>#{rank}</b> {category} for <i><b>{sats} sats</b></i>
    </div>
  )
}
