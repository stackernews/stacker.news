import Link from 'next/link'
import { abbrNum, numWithUnits } from '@/lib/format'
import styles from './item.module.css'
import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import MoreFooter from './more-footer'
import { useData } from './use-data'
import Info from './info'
import { TerritoryInfo } from './territory-header'

// all of this nonsense is to show the stat we are sorting by first
const Revenue = ({ sub }) => (sub.optional.revenue !== null && <span>{abbrNum(sub.optional.revenue)} revenue</span>)
const Stacked = ({ sub }) => (sub.optional.stacked !== null && <span>{abbrNum(sub.optional.stacked)} stacked</span>)
const Spent = ({ sub }) => (sub.optional.spent !== null && <span>{abbrNum(sub.optional.spent)} spent</span>)
const Posts = ({ sub }) => (
  <span>
    {numWithUnits(sub.nposts, { unitSingular: 'post', unitPlural: 'posts' })}
  </span>)
const Comments = ({ sub }) => (
  <span>
    {numWithUnits(sub.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })}
  </span>)
const Separator = () => (<span> \ </span>)

const STAT_POS = {
  stacked: 0,
  revenue: 1,
  spent: 2,
  posts: 3,
  comments: 4
}
const STAT_COMPONENTS = [Stacked, Revenue, Spent, Posts, Comments]

function separate (arr, separator) {
  return arr.flatMap((x, i) => i < arr.length - 1 ? [x, separator] : [x])
}

export default function TerritoryList ({ ssrData, query, variables, destructureData, rank }) {
  const { data, fetchMore } = useQuery(query, { variables })
  const dat = useData(data, ssrData)
  const [statComps, setStatComps] = useState(separate(STAT_COMPONENTS, Separator))

  useEffect(() => {
    // shift the stat we are sorting by to the front
    const comps = [...STAT_COMPONENTS]
    setStatComps(separate([...comps.splice(STAT_POS[variables?.by || 0], 1), ...comps], Separator))
  }, [variables?.by])

  const { subs, cursor } = useMemo(() => {
    if (!dat) return {}
    if (destructureData) {
      return destructureData(dat)
    } else {
      return dat
    }
  }, [dat])

  if (!dat) {
    return <SubsSkeleton />
  }

  return (
    <>
      <div className={styles.grid}>
        {subs?.map((sub, i) => (
          <React.Fragment key={sub.name}>
            {rank
              ? (
                <div className={styles.rank}>
                  {i + 1}
                </div>)
              : <div />}
            <div className={`${styles.item} mb-2`}>
              <div className={styles.hunk}>
                <div className='d-flex align-items-center'>
                  <Link href={`/~${sub.name}`} className={`${styles.title} mb-0 d-inline-flex align-items-center text-reset`}>
                    {sub.name}
                  </Link>
                  <Info className='d-flex'><TerritoryInfo sub={sub} /></Info>
                </div>
                <div className={styles.other}>
                  {statComps.map((Comp, i) => <Comp key={i} sub={sub} />)}
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <MoreFooter cursor={cursor} count={subs?.length} fetchMore={fetchMore} Skeleton={SubsSkeleton} noMoreText='NO MORE' />
    </>
  )
}

export function SubsSkeleton () {
  const subs = new Array(21).fill(null)

  return (
    <div>{subs.map((_, i) => (
      <div className={`${styles.item} ${styles.skeleton} mb-2`} key={i}>
        <div className={styles.hunk}>
          <div className={`${styles.name} clouds text-reset`} />
          <div className={styles.other}>
            <span className={`${styles.otherItem} clouds`} />
            <span className={`${styles.otherItem} clouds`} />
            <span className={`${styles.otherItem} ${styles.otherItemLonger} clouds`} />
            <span className={`${styles.otherItem} ${styles.otherItemLonger} clouds`} />
          </div>
        </div>
      </div>
    ))}
    </div>
  )
}
