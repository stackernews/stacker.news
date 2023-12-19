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
import DontLikeThisDropdownItem from './dont-link-this'
import BookmarkDropdownItem from './bookmark'
import SubscribeDropdownItem from './subscribe'
import { CopyLinkDropdownItem } from './share'
import Hat from './hat'
import { AD_USER_ID } from '../lib/constants'
import ActionDropdown from './action-dropdown'
import MuteDropdownItem from './mute'

export default function ItemInfo ({
  item, pendingSats, full, commentsText = 'comments',
  commentTextSingular = 'comment', className, embellishUser, extraInfo, onEdit, editText,
  onQuoteReply, nofollow, extraBadges
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
      {!item.position && !(!item.parentId && Number(item.user?.id) === AD_USER_ID) &&
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
        rel={nofollow}
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
        <Link rel={nofollow} href={`/items/${item.id}`} title={item.createdAt} className='text-reset' suppressHydrationWarning>
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
        (item.freebie && !item.position &&
          <Link href='/recent/freebies'>
            {' '}<Badge className={styles.newComment} bg={null}>freebie</Badge>
          </Link>
        )}
      {extraBadges}
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
      <ActionDropdown>
        <CopyLinkDropdownItem item={item} />
        {(item.parentId || item.text) && onQuoteReply &&
          <Dropdown.Item onClick={onQuoteReply}>quote reply</Dropdown.Item>}
        {me && <BookmarkDropdownItem item={item} />}
        {me && <SubscribeDropdownItem item={item} />}
        {item.otsHash &&
          <Link href={`/items/${item.id}/ots`} className='text-reset dropdown-item'>
            opentimestamp
          </Link>}
        {me && !item.meSats && !item.position &&
          !item.mine && !item.deletedAt && <DontLikeThisDropdownItem id={item.id} />}
        {me && item?.noteId && (
          <Dropdown.Item onClick={() => window.open(`https://nostr.com/${item.noteId}`, '_blank', 'noopener')}>
            nostr note
          </Dropdown.Item>
        )}
        {item.mine && !item.position && !item.deletedAt && !item.bio &&
          <DeleteDropdownItem itemId={item.id} type={item.title ? 'post' : 'comment'} />}
        {me && !item.mine &&
          <>
            <hr className='dropdown-divider' />
            <MuteDropdownItem user={item.user} />
          </>}
      </ActionDropdown>
      {extraInfo}
    </div>
  )
}
