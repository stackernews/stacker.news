import { string } from 'yup'
import Toc from './table-of-contents'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Image from 'react-bootstrap/Image'
import { SearchTitle } from './item'
import styles from './item.module.css'
import Link from 'next/link'
import { timeSince } from '../lib/time'
import EmailIcon from '../svgs/mail-open-line.svg'
import Share from './share'
import Hat from './hat'

export default function ItemJob ({ item, toc, rank, children }) {
  const isEmail = string().email().isValidSync(item.url)

  return (
    <>
      {rank
        ? (
          <div className={`${styles.rank} pb-2 align-self-center`}>
            {rank}
          </div>)
        : <div />}
      <div className={styles.item}>
        <Link href={`/items/${item.id}`}>
          <Image
            src={item.uploadId ? `https://${process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET}.s3.amazonaws.com/${item.uploadId}` : '/jobs-default.png'} width='42' height='42' className={styles.companyImage}
          />
        </Link>
        <div className={`${styles.hunk} align-self-center mb-0`}>
          <div className={`${styles.main} flex-wrap d-inline`}>
            <Link href={`/items/${item.id}`} className={`${styles.title} text-reset me-2`}>
              {item.searchTitle
                ? <SearchTitle title={item.searchTitle} />
                : (
                  <>{item.title}</>)}
            </Link>
          </div>
          <div className={styles.other}>
            {item.company &&
              <>
                {item.company}
              </>}
            {(item.location || item.remote) &&
              <>
                <span> \ </span>
                {`${item.location || ''}${item.location && item.remote ? ' or ' : ''}${item.remote ? 'Remote' : ''}`}
              </>}
            <wbr />
            <span> \ </span>
            <span>
              <Link href={`/${item.user.name}`} className='d-inline-flex align-items-center'>
                @{item.user.name}<Hat className='ms-1 fill-grey' user={item.user} height={12} width={12} />
              </Link>
              <span> </span>
              <Link href={`/items/${item.id}`} title={item.createdAt} className='text-reset' suppressHydrationWarning>
                {timeSince(new Date(item.createdAt))}
              </Link>
            </span>
            {item.mine &&
              (
                <>
                  <wbr />
                  <span> \ </span>
                  <Link href={`/items/${item.id}/edit`} className='text-reset'>
                    edit
                  </Link>
                  {item.status !== 'ACTIVE' && <span className='ms-1 fw-bold text-boost'> {item.status}</span>}
                </>)}
            {item.maxBid > 0 && item.status === 'ACTIVE' && <Badge className={`${styles.newComment} ms-1`}>PROMOTED</Badge>}
          </div>
        </div>
        {toc &&
          <>
            <Share item={item} />
            <Toc text={item.text} />
          </>}
      </div>
      {children && (
        <div className={styles.children} style={{ marginLeft: 'calc(42px + .8rem)' }}>
          <div className='mb-3 d-flex'>
            <Button
              target='_blank' href={isEmail ? `mailto:${item.url}?subject=${encodeURIComponent(item.title)} via Stacker News` : item.url}
            >
              apply {isEmail && <EmailIcon className='ms-1' />}
            </Button>
            {isEmail && <div className='ms-3 align-self-center text-muted fw-bold'>{item.url}</div>}
          </div>
          {children}
        </div>
      )}
    </>
  )
}
