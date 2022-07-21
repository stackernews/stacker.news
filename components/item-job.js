import * as Yup from 'yup'
import Toc from './table-of-contents'
import { Button, Image } from 'react-bootstrap'
import { SearchTitle } from './item'
import styles from './item.module.css'
import Link from 'next/link'
import { timeSince } from '../lib/time'
import EmailIcon from '../svgs/mail-open-line.svg'

export default function ItemJob ({ item, toc, rank, children }) {
  const isEmail = Yup.string().email().isValidSync(item.url)

  return (
    <>
      {rank
        ? (
          <div className={`${styles.rank} align-self-center`}>
            {rank}
          </div>)
        : <div />}
      <div className={`${styles.item} ${item.status === 'NOSATS' && !item.mine ? styles.itemDead : ''}`}>
        <Link href={`/items/${item.id}`} passHref>
          <a>
            <Image
              src={item.uploadId ? `https://${process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET}.s3.amazonaws.com/${item.uploadId}` : '/jobs-default.png'} width='42' height='42' className={styles.companyImage}
            />
          </a>
        </Link>
        <div className={`${styles.hunk} align-self-center mb-0`}>
          <div className={`${styles.main} flex-wrap d-inline`}>
            <Link href={`/items/${item.id}`} passHref>
              <a className={`${styles.title} text-reset mr-2`}>
                {item.searchTitle
                  ? <SearchTitle title={item.searchTitle} />
                  : (
                    <>{item.title}</>)}
              </a>
            </Link>
          </div>
          <div className={`${styles.other}`}>
            {item.status === 'NOSATS' &&
              <>
                <span>expired</span>
                {item.company && <span> \ </span>}
              </>}
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
              <Link href={`/${item.user.name}`} passHref>
                <a>@{item.user.name}</a>
              </Link>
              <span> </span>
              <Link href={`/items/${item.id}`} passHref>
                <a title={item.createdAt} className='text-reset'>{timeSince(new Date(item.createdAt))}</a>
              </Link>
            </span>
            {item.mine &&
              <>
                <wbr />
                <span> \ </span>
                <Link href={`/items/${item.id}/edit`} passHref>
                  <a className='text-reset'>
                    edit
                  </a>
                </Link>
                {item.status !== 'ACTIVE' && <span className='font-weight-bold text-danger'> {item.status}</span>}
              </>}
          </div>
        </div>
        {toc && <Toc text={item.text} />}
      </div>
      {children && (
        <div className={`${styles.children}`} style={{ marginLeft: 'calc(42px + .8rem)' }}>
          <div className='mb-3 d-flex'>
            <Button
              target='_blank' href={isEmail ? `mailto:${item.url}?subject=${encodeURIComponent(item.title)} via Stacker News` : item.url}
            >
              apply {isEmail && <EmailIcon className='ml-1' />}
            </Button>
            {isEmail && <div className='ml-3 align-self-center text-muted font-weight-bold'>{item.url}</div>}
          </div>
          {children}
        </div>
      )}
    </>
  )
}
