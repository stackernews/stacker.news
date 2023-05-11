import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { Badge, Dropdown } from 'react-bootstrap'
import Countdown from './countdown'
import { abbrNum } from '../lib/format'
import { newComments } from '../lib/new-comments'
import { timeSince } from '../lib/time'
import CowboyHat from './cowboy-hat'
import { DeleteDropdownItem } from './delete'
import styles from './item.module.css'
import { useMe } from './me'
import MoreIcon from '../svgs/more-fill.svg'
import DontLikeThisDropdownItem from './dont-link-this'
import BookmarkDropdownItem from './bookmark'
import { CopyLinkDropdownItem } from './share'

export default function ItemInfo ({ item, full, commentsText, className, embellishUser, extraInfo, onEdit, editText }) {
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
          <span title={`from ${item.upvotes} users ${item.mine ? `\\ ${item.meSats} sats to post` : `(${item.meSats} sats from me)`} `}>{abbrNum(item.sats)} sats</span>
          <span> \ </span>
        </>}
      {item.boost > 0 &&
        <>
          <span>{abbrNum(item.boost)} boost</span>
          <span> \ </span>
        </>}
      <Link href={`/items/${item.id}`} passHref>
        <a title={`${item.commentSats} sats`} className='text-reset'>
          {item.ncomments} {commentsText || 'comments'}
          {hasNewComments && <>{' '}<Badge className={styles.newComment} variant={null}>new</Badge></>}
        </a>
      </Link>
      <span> \ </span>
      <span>
        <Link href={`/${item.user.name}`} passHref>
          <a className='d-inline-flex align-items-center'>
            @{item.user.name}<CowboyHat className='ml-1 fill-grey' user={item.user} height={12} width={12} />
            {embellishUser}
          </a>
        </Link>
        <span> </span>
        <Link href={`/items/${item.id}`} passHref>
          <a title={item.createdAt} className='text-reset'>{timeSince(new Date(item.createdAt))}</a>
        </Link>
        {item.prior &&
          <>
            <span> \ </span>
            <Link href={`/items/${item.prior}`} passHref>
              <a className='text-reset'>yesterday</a>
            </Link>
          </>}
      </span>
      {item.subName &&
        <Link href={`/~${item.subName}`}>
          <a>{' '}<Badge className={styles.newComment} variant={null}>{item.subName}</Badge></a>
        </Link>}
      {(item.outlawed && !item.mine &&
        <Link href='/outlawed'>
          <a>{' '}<Badge className={styles.newComment} variant={null}>outlawed</Badge></a>
        </Link>) ||
        (item.freebie && !item.mine &&
          <Link href='/freebie'>
            <a>{' '}<Badge className={styles.newComment} variant={null}>freebie</Badge></a>
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
        {item.otsHash &&
          <Dropdown.Item>
            <Link passHref href={`/items/${item.id}/ots`}>
              <a className='text-reset'>ots timestamp</a>
            </Link>
          </Dropdown.Item>}
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
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle variant='success' id='dropdown-basic' as='a'>
        <MoreIcon className='fill-grey ml-1' height={16} width={16} />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {children}
      </Dropdown.Menu>
    </Dropdown>
  )
}
