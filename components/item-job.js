import { string } from 'yup'
import Toc from './table-of-contents'
import Button from 'react-bootstrap/Button'
import Image from 'react-bootstrap/Image'
import { SearchTitle } from './item'
import styles from './item.module.css'
import Link from 'next/link'
import { timeSince } from '@/lib/time'
import EmailIcon from '@/svgs/mail-open-line.svg'
import Share from './share'
import Badges from './badge'
import { MEDIA_URL } from '@/lib/constants'
import { abbrNum } from '@/lib/format'
import { Badge } from 'react-bootstrap'
import SubPopover from './sub-popover'
import { PayInInfo } from './item-info'

export default function ItemJob ({ item, toc, rank, children, ...props }) {
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
            src={item.uploadId ? `${MEDIA_URL}/${item.uploadId}` : '/jobs-default.png'} width='42' height='42' className={styles.companyImage}
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
            {item.boost > 0 && <span>{abbrNum(item.boost)} boost \ </span>}
            <span>
              <Link href={`/${item.user.name}`} className='d-inline-flex align-items-center'>
                @{item.user.name}<Badges badgeClassName='fill-grey' height={12} width={12} user={item.user} />
              </Link>
              <span> </span>
              <Link href={`/items/${item.id}`} title={item.createdAt} className='text-reset' suppressHydrationWarning>
                {timeSince(new Date(item.createdAt))}
              </Link>
            </span>
            {item.subName &&
              <SubPopover sub={item.subName}>
                <Link href={`/~${item.subName}`}>
                  {' '}<Badge className={styles.newComment} bg={null}>{item.subName}</Badge>
                </Link>
              </SubPopover>}
            {item.status === 'STOPPED' &&
              <>{' '}<Badge bg='info' className={styles.badge}>stopped</Badge></>}
            {item.mine && !item.deletedAt &&
              (
                <>
                  <wbr />
                  <span> \ </span>
                  <Link href={`/items/${item.id}/edit`} className='text-reset fw-bold'>
                    edit
                  </Link>
                  <PayInInfo item={item} {...props} />
                </>)}
          </div>
        </div>
        {toc &&
          <>
            <Share title={item?.title} path={`/items/${item?.id}`} />
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
