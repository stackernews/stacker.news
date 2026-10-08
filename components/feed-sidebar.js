import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { TOP_TERRITORIES } from '@/fragments/subs'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import TerritoryHeader from './territory-header'
import { useBranding } from './territory-branding'
import styles from './item.module.css'

export default function FeedSidebar ({ sub }) {
  return sub ? <TerritoryHeader key={sub.name} sub={sub} show /> : <TopTerritories />
}

function TopTerritories () {
  const { data, error } = useQuery(TOP_TERRITORIES)
  const { me } = useMe()
  const branding = useBranding()
  const prefix = branding ? process.env.NEXT_PUBLIC_URL : ''
  const territories = data?.topSubs?.subs.filter(sub => !sub.nsfw || me?.privates?.nsfwMode)

  return (
    <div className='flex flex-col gap-4'>
      <nav aria-label='top territories' aria-busy={!territories && !error}>
        <h2 className='mb-0 text-base font-bold text-muted' title='ranked by sats stacked in the past day'>top territories</h2>
        {!territories
          ? (error ? <div className='small text-muted'>couldn't load territories</div> : <TopTerritoriesSkeleton />)
          : territories.length === 0
            ? <div className='small text-muted'>no territory activity in the past day</div>
            : (
              <ol className='m-0 list-none p-0'>
                {territories.map(territory => (
                  <li key={territory.name} className={`${styles.hunk} flex flex-wrap items-baseline gap-x-2 py-0.5`}>
                    <Link
                      href={branding?.subName === territory.name ? '/' : `${prefix}/~${territory.name}`}
                      className={`${styles.title} mb-0 min-w-0 wrap-break-word visited:text-reset`}
                    >
                      {territory.name}
                    </Link>
                    {territory.optional.stacked !== null && (
                      <div className={`${styles.other} mb-0 whitespace-nowrap`}>{numWithUnits(territory.optional.stacked)} stacked</div>
                    )}
                  </li>
                ))}
              </ol>
              )}
      </nav>
    </div>
  )
}

function TopTerritoriesSkeleton () {
  return (
    <div aria-hidden='true'>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`${styles.skeleton} ${styles.hunk} flex flex-wrap items-baseline gap-x-2 py-0.5`}>
          <div className={`${styles.name} clouds`} />
          <div className={`${styles.other} mb-0`}>
            <span className={`${styles.otherItem} ${styles.otherItemLonger} clouds`} />
          </div>
        </div>
      ))}
    </div>
  )
}
