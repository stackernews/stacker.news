import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import { ME_REWARDS } from '@/fragments/rewards'
import { CenterLayout } from '@/components/layout'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { fixedDecimal } from '@/lib/format'
import Trophy from '@/svgs/trophy-fill.svg'
import { ListItem } from '@/components/items'
import { dayMonthYear } from '@/lib/time'
import { GrowthPieChartSkeleton } from '@/components/charts-skeletons'

const GrowthPieChart = dynamic(() => import('@/components/charts').then(mod => mod.GrowthPieChart), {
  loading: () => <GrowthPieChartSkeleton />
})

export const getServerSideProps = getGetServerSideProps({
  query: ME_REWARDS,
  notFound: (data, params) => data.rewards.reduce((a, r) => a || new Date(r.time) > new Date(), false)
})

export default function Rewards ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(ME_REWARDS, { variables: { ...router.query } })
  if (!data && !ssrData) return <PageLoading />

  const { rewards, meRewards } = data || ssrData

  return (
    <CenterLayout footerLinks>
      <div className='mw-100'>
        {rewards.map(({ total, sources, time }, i) => (
          <div className='py-3 w-100 d-grid' key={time} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <h4 className='fw-bold text-muted ps-0'>
              {time && <div className='text-muted fst-italic fs-6 fw-normal pb-1'>On {dayMonthYear(time)} at 12a CT</div>}
              {total} sats were rewarded
            </h4>
            <div className='my-3 w-100 justify-self-center'>
              <GrowthPieChart data={sources} />
            </div>
            {meRewards[i] &&
              <div className='justify-self-center mw-100'>
                <h4 className='fw-bold text-muted'>
                  you earned {meRewards[i].total} sats ({fixedDecimal(meRewards[i].total * 100 / total, 2)}%)
                </h4>
                <div>
                  {meRewards[i].rewards?.map((r, i) => <Reward key={[r.rank, r.type].join('-')} {...r} />)}
                </div>
              </div>}
          </div>
        ))}
      </div>
    </CenterLayout>
  )
}

function Reward ({ rank, type, sats, item }) {
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
    <div>
      <div className={color}>
        <Trophy height={20} width={20} /> <b>#{rank}</b> {category} for <i><b>{sats} sats</b></i>
      </div>
      {item &&
        <div className={item.parentId ? 'pt-0' : 'pt-2'}>
          <ListItem item={item} />
        </div>}
    </div>
  )
}
