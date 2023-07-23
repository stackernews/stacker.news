import Link from 'next/link'
import { Image } from 'react-bootstrap'
import { abbrNum } from '../lib/format'
import CowboyHat from './cowboy-hat'
import styles from './item.module.css'
import userStyles from './user-header.module.css'
import { useEffect, useState } from 'react'

// all of this nonsense is to show the stat we are sorting by first
const Stacked = ({ user }) => (<span>{abbrNum(user.stacked)} stacked</span>)
const Spent = ({ user }) => (<span>{abbrNum(user.spent)} spent</span>)
const Posts = ({ user }) => (
  <Link href={`/${user.name}/posts`} passHref>
    <a className='text-reset'>{abbrNum(user.nitems)} posts</a>
  </Link>)
const Comments = ({ user }) => (
  <Link href={`/${user.name}/comments`} passHref>
    <a className='text-reset'>{abbrNum(user.ncomments)} comments</a>
  </Link>)
const Referrals = ({ user }) => (<span>{abbrNum(user.referrals)} referrals</span>)
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

export default function UserList ({ users, sort }) {
  const [statComps, setStatComps] = useState(seperate(STAT_COMPONENTS, Seperator))

  useEffect(() => {
    if (sort) {
      // shift the stat we are sorting by to the front
      const comps = [...STAT_COMPONENTS]
      setStatComps(seperate([...comps.splice(STAT_POS[sort], 1), ...comps], Seperator))
    }
  }, [sort])

  return (
    <> {users.map(user => (
      <div className={`${styles.item} mb-2`} key={user.name}>
        <Link href={`/${user.name}`} passHref>
          <a>
            <Image
              src={user.photoId ? `https://${process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET}.s3.amazonaws.com/${user.photoId}` : '/dorian400.jpg'} width='32' height='32'
              className={`${userStyles.userimg} mr-2`}
            />
          </a>
        </Link>
        <div className={styles.hunk}>
          <Link href={`/${user.name}`} passHref>
            <a className={`${styles.title} d-inline-flex align-items-center text-reset`}>
              @{user.name}<CowboyHat className='ml-1 fill-grey' height={14} width={14} user={user} />
            </a>
          </Link>
          <div className={styles.other}>
            {statComps.map((Comp, i) => <Comp key={i} user={user} />)}
          </div>
        </div>
      </div>
    ))}
    </>
  )
}

export function UsersSkeleton () {
  const users = new Array(21).fill(null)

  return (
    <div>{users.map((_, i) => (
      <div className={`${styles.item} ${styles.skeleton} mb-2`} key={i}>
        <Image
          src='/clouds.jpeg' width='32' height='32'
          className={`${userStyles.userimg} clouds mr-2`}
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
