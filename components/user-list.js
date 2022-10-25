import Link from 'next/link'
import { Image } from 'react-bootstrap'
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
            <a className={`${styles.title} text-reset`}>
              @{user.name}
            </a>
          </Link>
          <div className={styles.other}>
            <span>{user.stacked} stacked</span>
            <span> \ </span>
            <span>{user.spent} spent</span>
            <span> \ </span>
            <Link href={`/${user.name}/posts`} passHref>
              <a className='text-reset'>
                {user.nitems} posts
              </a>
            </Link>
            <span> \ </span>
            <Link href={`/${user.name}/comments`} passHref>
              <a className='text-reset'>
                {user.ncomments} comments
              </a>
            </Link>
          </div>
        </div>
      </div>
    ))}
    </>
  )
}
