import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Badge from 'react-bootstrap/Badge'
import Dropdown from 'react-bootstrap/Dropdown'
import Countdown from './countdown'
import { abbrNum } from '../lib/format'
import { newComments, commentsViewedAt } from '../lib/new-comments'
import { timeSince } from '../lib/time'
import CowboyHat from './cowboy-hat'
import { DeleteDropdownItem } from './delete'
import styles from './item.module.css'
import { useMe } from './me'
import MoreIcon from '../svgs/more-fill.svg'
import DontLikeThisDropdownItem from './dont-link-this'
import BookmarkDropdownItem from './bookmark'
import SubscribeDropdownItem from './subscribe'
import { CopyLinkDropdownItem } from './share'

export default function ItemInfo ({ item, pendingSats, full, commentsText, className, embellishUser, extraInfo, onEdit, editText }) {
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000
  const me = useMe()
  const router = useRouter()
  const [canEdit, setCanEdit] =
    useState(item.mine && (Date.now() < editThreshold))
  const [hasNewComments, setHasNewComments] = useState(false)
  useEffect(() => {
    if (!full) {
      setHasNewComments(newComments(item))
    }
  }, [item])

  return (
    <div className={className || `${styles.other}`}>
      {!item.position &&
        <>
          <span title={`from ${item.upvotes} stackers ${item.mine ? `\\ ${item.meSats} sats to post` : `(${item.meSats + pendingSats} sats from me)`} `}>{abbrNum(item.sats + pendingSats)} sats</span>
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
        }} title={`${item.commentSats} sats`} className='text-reset position-relative'
      >
        {item.ncomments} {commentsText || 'comments'}
        {hasNewComments &&
          <span className={styles.notification}>
            <span className='invisible'>{' '}</span>
          </span>}
      </Link>
      <span> \ </span>
      <span>
        <Link href={`/${item.user.name}`}>
          @{item.user.name}<CowboyHat className='ms-1 fill-grey' user={item.user} height={12} width={12} />
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
