import Link from 'next/link'
import { Image } from 'react-bootstrap'
import { abbrNum } from '../lib/format'
import CowboyHat from './cowboy-hat'
import styles from './item.module.css'
import userStyles from './user-header.module.css'

export default function UserList ({ users }) {
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
            <span>{abbrNum(user.stacked)} stacked</span>
            <span> \ </span>
            <span>{abbrNum(user.spent)} spent</span>
            <span> \ </span>
            <Link href={`/${user.name}/posts`} passHref>
              <a className='text-reset'>
                {abbrNum(user.nitems)} posts
              </a>
            </Link>
            <span> \ </span>
            <Link href={`/${user.name}/comments`} passHref>
              <a className='text-reset'>
                {abbrNum(user.ncomments)} comments
              </a>
            </Link>
            {user.referrals > 0 && <span> \ {abbrNum(user.referrals)} referrals</span>}
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
