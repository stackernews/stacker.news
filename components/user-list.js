import Link from 'next/link'
import Image from 'react-bootstrap/Image'
import { abbrNum, numWithUnits } from '@/lib/format'
import styles from './item.module.css'
import userStyles from './user-header.module.css'
import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import MoreFooter from './more-footer'
import { useData } from './use-data'
import Hat from './hat'
import { useMe } from './me'
import { MEDIA_URL } from '@/lib/constants'
import { NymActionDropdown } from '@/components/user-header'
import classNames from 'classnames'

// all of this nonsense is to show the stat we are sorting by first
const Stacked = ({ user }) => (user.optional.stacked !== null && <span>{abbrNum(user.optional.stacked)} stacked</span>)
const Spent = ({ user }) => (user.optional.spent !== null && <span>{abbrNum(user.optional.spent)} spent</span>)
const Posts = ({ user }) => (
  <Link href={`/${user.name}/posts`} className='text-reset'>
    {numWithUnits(user.nposts, { unitSingular: 'post', unitPlural: 'posts' })}
  </Link>)
const Comments = ({ user }) => (
  <Link href={`/${user.name}/comments`} className='text-reset'>
    {numWithUnits(user.ncomments, { unitSingular: 'comment', unitPlural: 'comments' })}
  </Link>)
const Referrals = ({ user }) => (user.optional.referrals !== null && <span>{numWithUnits(user.optional.referrals, { unitSingular: 'referral', unitPlural: 'referrals' })}</span>)
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

export function UserListRow ({ user, stats, className, onNymClick, showHat = true, selected }) {
  return (
    <div className={`${styles.item} mb-2`} key={user.name}>
      <Link href={`/${user.name}`}>
        <Image
          src={user.photoId ? `${MEDIA_URL}/${user.photoId}` : '/dorian400.jpg'} width='32' height='32'
          className={`${userStyles.userimg} me-2`}
        />
      </Link>
      <div className={`${styles.hunk} ${className}`}>
        <Link
          href={`/${user.name}`} className={`${styles.title} d-inline-flex align-items-center text-reset ${selected ? 'fw-bold' : ''}`} onClick={onNymClick}
        >
          @{user.name}{showHat && <Hat className='ms-1 fill-grey' height={14} width={14} user={user} />}
        </Link>
        {stats && (
          <div className={styles.other}>
            {stats.map((Comp, i) => <Comp key={i} user={user} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export function UserBase ({ user, className, children, nymActionDropdown }) {
  return (
    <div className={classNames(styles.item, className)}>
      <Link href={`/${user.name}`}>
        <Image
          src={user.photoId ? `${MEDIA_URL}/${user.photoId}` : '/dorian400.jpg'} width='32' height='32'
          className={`${userStyles.userimg} me-2`}
        />
      </Link>
      <div className={styles.hunk}>
        <div className='d-flex'>
          <Link href={`/${user.name}`} className={`${styles.title} d-inline-flex align-items-center text-reset`}>
            @{user.name}<Hat className='ms-1 fill-grey' height={14} width={14} user={user} />
          </Link>
          {nymActionDropdown && <NymActionDropdown user={user} className='' />}
        </div>
        {children}
      </div>
    </div>
  )
}

export function User ({ user, rank, statComps, className = 'mb-2', Embellish, nymActionDropdown = false }) {
  const { me } = useMe()
  const showStatComps = statComps && statComps.length > 0
  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <UserBase user={user} nymActionDropdown={nymActionDropdown} className={(me?.id === user.id && me.privates?.hideFromTopUsers) ? userStyles.hidden : 'mb-2'}>
        {showStatComps &&
          <div className={styles.other}>
            {statComps.map((Comp, i) => <Comp key={i} user={user} />)}
          </div>}
        {Embellish && <Embellish rank={rank} />}
      </UserBase>
    </>
  )
}

function UserHidden ({ rank, Embellish }) {
  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={`${styles.item} mb-2`}>
        <span>
          <Image
            src='/dorian400.jpg' width='32' height='32'
            className={`${userStyles.userimg} me-2 opacity-50`}
          />
        </span>
        <div className={`${styles.hunk} d-flex justify-content-center flex-column`}>
          <div className={`${styles.title} text-muted d-inline-flex align-items-center`}>
            stacker is in hiding
          </div>
          {Embellish && <Embellish rank={rank} />}
        </div>
      </div>
    </>
  )
}

export function ListUsers ({ users, rank, statComps = seperate(STAT_COMPONENTS, Seperator), Embellish, nymActionDropdown }) {
  return (
    <div className={styles.grid}>
      {users.map((user, i) => (
        user
          ? <User key={user.id} user={user} rank={rank && i + 1} statComps={statComps} Embellish={Embellish} nymActionDropdown={nymActionDropdown} />
          : <UserHidden key={i} rank={rank && i + 1} Embellish={Embellish} />
      ))}
    </div>
  )
}

export default function UserList ({ ssrData, query, variables, destructureData, rank, footer = true, nymActionDropdown, statCompsProp }) {
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
      <ListUsers users={users} rank={rank} statComps={statCompsProp ?? statComps} nymActionDropdown={nymActionDropdown} />
      {footer &&
        <MoreFooter cursor={cursor} count={users?.length} fetchMore={fetchMore} Skeleton={UsersSkeleton} noMoreText='NO MORE' />}
    </>
  )
}

export function UsersSkeleton () {
  const users = new Array(21).fill(null)

  return (
    <div>{users.map((_, i) => (
      <UserSkeleton key={i} className='mb-2'>
        <div className={styles.other}>
          <span className={`${styles.otherItem} clouds`} />
          <span className={`${styles.otherItem} clouds`} />
          <span className={`${styles.otherItem} ${styles.otherItemLonger} clouds`} />
          <span className={`${styles.otherItem} ${styles.otherItemLonger} clouds`} />
        </div>
      </UserSkeleton>
    ))}
    </div>
  )
}

export function UserSkeleton ({ children, className }) {
  return (
    <div className={`${styles.item} ${styles.skeleton} ${className}`}>
      <Image
        src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/clouds.jpeg`}
        width='32' height='32'
        className={`${userStyles.userimg} clouds me-2`}
      />
      <div className={styles.hunk}>
        <div className={`${styles.name} clouds text-reset`} />
        {children}
      </div>
    </div>
  )
}
