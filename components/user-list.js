import Link from 'next/link'
import Image from 'react-bootstrap/Image'
import { abbrNum, numWithUnits } from '../lib/format'
import styles from './item.module.css'
import userStyles from './user-header.module.css'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import MoreFooter from './more-footer'
import { useData } from './use-data'
import Hat from './hat'

// all of this nonsense is to show the stat we are sorting by first
const Stacked = ({ user }) => (<span>{abbrNum(user.stacked)} stacked</span>)
const Spent = ({ user }) => (<span>{abbrNum(user.spent)} spent</span>)
const Posts = ({ user }) => (
  <Link href={`/${user.name}/posts`} className='text-reset'>
    {numWithUnits(user.nposts, { unitSingular: 'post', unitPlural: 'posts' })}
  </Link>)
const Comments = ({ user }) => (
  <Link href={`/${user.name}/comments`} className='text-reset'>
    {numWithUnits(user.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })}
  </Link>)
const Referrals = ({ user }) => (<span>{numWithUnits(user.referrals, { unitSingular: 'referral', unitPlural: 'referrals' })}</span>)
const Seperator = () => (<span> \ </span>)

const STAT_POS = {
  stacked: 0,
  spent: 1,
  posts: 2,
  comments: 3,
  referrals: 4
}
const STAT_COMPONENTS = [Stacked, Spent, Posts, Comments, Referrals]

function seperate (arr, seperator) {
  return arr.flatMap((x, i) => i < arr.length - 1 ? [x, seperator] : [x])
}

export default function UserList ({ ssrData, query, variables, destructureData }) {
  const { data, fetchMore } = useQuery(query, { variables })
  const dat = useData(data, ssrData)
  const [statComps, setStatComps] = useState(seperate(STAT_COMPONENTS, Seperator))

  useEffect(() => {
    // shift the stat we are sorting by to the front
    const comps = [...STAT_COMPONENTS]
    setStatComps(seperate([...comps.splice(STAT_POS[variables?.by || 0], 1), ...comps], Seperator))
  }, [variables?.by])

  const { users, cursor } = useMemo(() => {
    if (!dat) return {}
    if (destructureData) {
      return destructureData(dat)
    } else {
      return dat
    }
  }, [dat])

  if (!dat) {
    return <UsersSkeleton />
  }

  return (
    <>
      {users?.map(user => (
        <div className={`${styles.item} mb-2`} key={user.name}>
          <Link href={`/${user.name}`}>
            <Image
              src={user.photoId ? `https://${process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET}.s3.amazonaws.com/${user.photoId}` : '/dorian400.jpg'} width='32' height='32'
              className={`${userStyles.userimg} me-2`}
            />
          </Link>
          <div className={styles.hunk}>
            <Link href={`/${user.name}`} className={`${styles.title} d-inline-flex align-items-center text-reset`}>
              @{user.name}<Hat className='ms-1 fill-grey' height={14} width={14} user={user} />
            </Link>
            <div className={styles.other}>
              {statComps.map((Comp, i) => <Comp key={i} user={user} />)}
            </div>
          </div>
        </div>
      ))}
      <MoreFooter cursor={cursor} count={users?.length} fetchMore={fetchMore} Skeleton={UsersSkeleton} noMoreText='NO MORE' />
    </>
  )
}

export function UsersSkeleton () {
  const users = new Array(21).fill(null)

  return (
    <div>{users.map((_, i) => (
      <div className={`${styles.item} ${styles.skeleton} mb-2`} key={i}>
        <Image
          src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/clouds.jpeg`}
          width='32' height='32'
          className={`${userStyles.userimg} clouds me-2`}
        />
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
