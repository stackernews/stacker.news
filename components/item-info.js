import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Badge from 'react-bootstrap/Badge'
import Dropdown from 'react-bootstrap/Dropdown'
import Countdown from './countdown'
import { abbrNum, numWithUnits } from '../lib/format'
import { newComments, commentsViewedAt } from '../lib/new-comments'
import { timeSince } from '../lib/time'
import { DeleteDropdownItem } from './delete'
import styles from './item.module.css'
import { useMe } from './me'
import MoreIcon from '../svgs/more-fill.svg'
import DontLikeThisDropdownItem from './dont-link-this'
import BookmarkDropdownItem from './bookmark'
import SubscribeDropdownItem from './subscribe'
import { CopyLinkDropdownItem } from './share'
import Hat from './hat'

export default function ItemInfo ({
  item, pendingSats, full, commentsText = 'comments',
  commentTextSingular = 'comment', className, embellishUser, extraInfo, onEdit, editText
}) {
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000
  const me = useMe()
  const router = useRouter()
  const [canEdit, setCanEdit] =
    useState(item.mine && (Date.now() < editThreshold))
  const [hasNewComments, setHasNewComments] = useState(false)
  const [meTotalSats, setMeTotalSats] = useState(0)

  useEffect(() => {
    if (!full) {
      setHasNewComments(newComments(item))
    }
  }, [item])

  useEffect(() => {
    if (item) setMeTotalSats(item.meSats + item.meAnonSats + pendingSats)
  }, [item?.meSats, item?.meAnonSats, pendingSats])

  return (
    <div className={className || `${styles.other}`}>
      {!item.position &&
        <>
          <span title={`from ${numWithUnits(item.upvotes, {
              abbreviate: false,
              unitSingular: 'stacker',
              unitPlural: 'stackers'
            })} ${item.mine
            ? `\\ ${numWithUnits(item.meSats, { abbreviate: false })} to post`
            : `(${numWithUnits(meTotalSats, { abbreviate: false })} from me)`} `}
          >
            {numWithUnits(item.sats + pendingSats)}
          </span>
          <span> \ </span>
        </>}
      {item.boost > 0 &&
        <>
          <span>{abbrNum(item.boost)} boost</span>
          <span> \ </span>
        </>}
      <Link
        href={`/items/${item.id}`} onClick={(e) => {
          const viewedAt = commentsViewedAt(item)
          if (viewedAt) {
            e.preventDefault()
            router.push(
              `/items/${item.id}?commentsViewedAt=${viewedAt}`,
              `/items/${item.id}`)
          }
        }} title={numWithUnits(item.commentSats)} className='text-reset position-relative'
      >
        {numWithUnits(item.ncomments, {
          abbreviate: false,
          unitPlural: commentsText,
          unitSingular: commentTextSingular
        })}
        {hasNewComments &&
          <span className={styles.notification}>
            <span className='invisible'>{' '}</span>
          </span>}
      </Link>
      <span> \ </span>
      <span>
        <Link href={`/${item.user.name}`}>
          @{item.user.name}<span> </span><Hat className='fill-grey' user={item.user} height={12} width={12} />
          {embellishUser}
        </Link>
        <span> </span>
        <Link href={`/items/${item.id}`} title={item.createdAt} className='text-reset' suppressHydrationWarning>
          {timeSince(new Date(item.createdAt))}
        </Link>
        {item.prior &&
          <>
            <span> \ </span>
            <Link href={`/items/${item.prior}`} className='text-reset'>
              yesterday
            </Link>
          </>}
      </span>
      {item.subName &&
        <Link href={`/~${item.subName}`}>
          {' '}<Badge className={styles.newComment} bg={null}>{item.subName}</Badge>
        </Link>}
      {(item.outlawed && !item.mine &&
        <Link href='/recent/outlawed'>
          {' '}<Badge className={styles.newComment} bg={null}>outlawed</Badge>
        </Link>) ||
        (item.freebie &&
          <Link href='/recent/freebies'>
            {' '}<Badge className={styles.newComment} bg={null}>freebie</Badge>
          </Link>
        )}
      {canEdit && !item.deletedAt &&
        <>
          <span> \ </span>
          <span
            className='text-reset pointer'
            onClick={() => onEdit ? onEdit() : router.push(`/items/${item.id}/edit`)}
          >
            {editText || 'edit'}
            <Countdown
              date={editThreshold}
              onComplete={() => {
                setCanEdit(false)
              }}
            />
          </span>
        </>}
      <ItemDropdown>
        <CopyLinkDropdownItem item={item} />
        {me && <BookmarkDropdownItem item={item} />}
        {me && item.user.id !== me.id && <SubscribeDropdownItem item={item} />}
        {item.otsHash &&
          <Link href={`/items/${item.id}/ots`} className='text-reset dropdown-item'>
            ots timestamp
          </Link>}
        {me && !item.meSats && !item.position && !item.meDontLike &&
          !item.mine && !item.deletedAt && <DontLikeThisDropdownItem id={item.id} />}
        {item.mine && !item.position && !item.deletedAt &&
          <DeleteDropdownItem itemId={item.id} />}
      </ItemDropdown>
      {extraInfo}
    </div>
  )
}

export function ItemDropdown ({ children }) {
  return (
    <Dropdown className={`pointer ${styles.dropdown}`} as='span'>
      <Dropdown.Toggle variant='success' as='a'>
        <MoreIcon className='fill-grey ms-1' height={16} width={16} />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {children}
      </Dropdown.Menu>
    </Dropdown>
  )
}
