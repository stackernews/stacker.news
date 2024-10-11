import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Badge from 'react-bootstrap/Badge'
import Dropdown from 'react-bootstrap/Dropdown'
import Countdown from './countdown'
import { abbrNum, numWithUnits } from '@/lib/format'
import { newComments, commentsViewedAt } from '@/lib/new-comments'
import { timeSince } from '@/lib/time'
import { DeleteDropdownItem } from './delete'
import styles from './item.module.css'
import { useMe } from './me'
import DontLikeThisDropdownItem, { OutlawDropdownItem } from './dont-link-this'
import BookmarkDropdownItem from './bookmark'
import SubscribeDropdownItem from './subscribe'
import { CopyLinkDropdownItem, CrosspostDropdownItem } from './share'
import Badges from './badge'
import { USER_ID } from '@/lib/constants'
import ActionDropdown from './action-dropdown'
import MuteDropdownItem from './mute'
import { DropdownItemUpVote } from './upvote'
import { useRoot } from './root'
import { MuteSubDropdownItem, PinSubDropdownItem } from './territory-header'
import UserPopover from './user-popover'
import { useQrPayment } from './payment'
import { useRetryCreateItem } from './use-item-submit'
import { useToast } from './toast'
import { useShowModal } from './modal'
import classNames from 'classnames'

export default function ItemInfo ({
  item, full, commentsText = 'comments',
  commentTextSingular = 'comment', className, embellishUser, extraInfo, onEdit, editText,
  onQuoteReply, extraBadges, nested, pinnable, showActionDropdown = true, showUser = true,
  setDisableRetry, disableRetry
}) {
  const editThreshold = new Date(item.invoice?.confirmedAt ?? item.createdAt).getTime() + 10 * 60000
  const { me } = useMe()
  const router = useRouter()
  const [canEdit, setCanEdit] = useState(item.mine && !item.bio && (Date.now() < editThreshold))
  const [hasNewComments, setHasNewComments] = useState(false)
  const root = useRoot()
  const sub = item?.sub || root?.sub

  useEffect(() => {
    if (!full) {
      setHasNewComments(newComments(item))
    }
  }, [item])

  useEffect(() => {
    const authorEdit = item.mine && !item.bio
    const invParams = window.localStorage.getItem(`item:${item.id}:hash:hmac`)
    const hmacEdit = !!invParams && !me && Number(item.user.id) === USER_ID.anon
    setCanEdit((authorEdit || hmacEdit) && (Date.now() < editThreshold))
  }, [me, item.id, item.mine, editThreshold])

  // territory founders can pin any post in their territory
  // and OPs can pin any root reply in their post
  const isPost = !item.parentId
  const mySub = (me && sub && Number(me.id) === sub.userId)
  const myPost = (me && root && Number(me.id) === Number(root.user.id))
  const rootReply = item.path.split('.').length === 2
  const canPin = (isPost && mySub) || (myPost && rootReply)
  const meSats = (me ? item.meSats : item.meAnonSats) || 0

  return (
    <div className={className || `${styles.other}`}>
      {!(item.position && (pinnable || !item.subName)) && !(!item.parentId && Number(item.user?.id) === USER_ID.ad) &&
        <>
          <span title={`from ${numWithUnits(item.upvotes, {
            abbreviate: false,
            unitSingular: 'stacker',
            unitPlural: 'stackers'
          })} ${item.mine
            ? `\\ ${numWithUnits(item.meSats, { abbreviate: false })} to post`
            : `(${numWithUnits(meSats, { abbreviate: false })}${item.meDontLikeSats
              ? ` & ${numWithUnits(item.meDontLikeSats, { abbreviate: false, unitSingular: 'downsat', unitPlural: 'downsats' })}`
              : ''} from me)`} `}
          >
            {numWithUnits(item.sats)}
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
        {showUser &&
          <Link href={`/${item.user.name}`}>
            <UserPopover name={item.user.name}>@{item.user.name}</UserPopover>
            <Badges badgeClassName='fill-grey' spacingClassName='ms-xs' height={12} width={12} user={item.user} />
            {embellishUser}
          </Link>}
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
      {sub?.nsfw &&
        <Badge className={styles.newComment} bg={null}>nsfw</Badge>}
      {(item.outlawed && !item.mine &&
        <Link href='/recent/outlawed'>
          {' '}<Badge className={styles.newComment} bg={null}>outlawed</Badge>
        </Link>) ||
        (item.freebie && !item.position &&
          <Link href='/recent/freebies'>
            {' '}<Badge className={styles.newComment} bg={null}>freebie</Badge>
          </Link>
        )}
      {(item.apiKey &&
        <>{' '}<Badge className={styles.newComment} bg={null}>bot</Badge></>
        )}
      {extraBadges}
      {
        showActionDropdown &&
          <>
            <EditInfo
              item={item} canEdit={canEdit}
              setCanEdit={setCanEdit} onEdit={onEdit} editText={editText} editThreshold={editThreshold}
            />
            <PaymentInfo item={item} disableRetry={disableRetry} setDisableRetry={setDisableRetry} />
            <ActionDropdown>
              <CopyLinkDropdownItem item={item} />
              <InfoDropdownItem item={item} />
              {(item.parentId || item.text) && onQuoteReply &&
                <Dropdown.Item onClick={onQuoteReply}>quote reply</Dropdown.Item>}
              {me && <BookmarkDropdownItem item={item} />}
              {me && <SubscribeDropdownItem item={item} />}
              {item.otsHash &&
                <Link href={`/items/${item.id}/ots`} className='text-reset dropdown-item'>
                  opentimestamp
                </Link>}
              {item?.noteId && (
                <Dropdown.Item onClick={() => window.open(`https://njump.me/${item.noteId}`, '_blank', 'noopener,noreferrer,nofollow')}>
                  nostr note
                </Dropdown.Item>
              )}
              {item && item.mine && !item.noteId && !item.isJob && !item.parentId &&
                <CrosspostDropdownItem item={item} />}
              {me && !item.position &&
            !item.mine && !item.deletedAt &&
            (item.meDontLikeSats > meSats
              ? <DropdownItemUpVote item={item} />
              : <DontLikeThisDropdownItem item={item} />)}
              {me && sub && !item.mine && !item.outlawed && Number(me.id) === Number(sub.userId) && sub.moderated &&
                <>
                  <hr className='dropdown-divider' />
                  <OutlawDropdownItem item={item} />
                </>}
              {item.mine && item.invoice?.id &&
                <>
                  <hr className='dropdown-divider' />
                  <Link href={`/invoices/${item.invoice?.id}`} className='text-reset dropdown-item'>
                    view invoice
                  </Link>
                </>}
              {me && !nested && !item.mine && sub && Number(me.id) !== Number(sub.userId) &&
                <>
                  <hr className='dropdown-divider' />
                  <MuteSubDropdownItem item={item} sub={sub} />
                </>}
              {canPin &&
                <>
                  <hr className='dropdown-divider' />
                  <PinSubDropdownItem item={item} />
                </>}
              {item.mine && !item.position && !item.deletedAt && !item.bio &&
                <>
                  <hr className='dropdown-divider' />
                  <DeleteDropdownItem itemId={item.id} type={item.title ? 'post' : 'comment'} />
                </>}
              {me && !item.mine &&
                <>
                  <hr className='dropdown-divider' />
                  <MuteDropdownItem user={item.user} />
                </>}
            </ActionDropdown>
          </>
      }
      {extraInfo}
    </div>
  )
}

function InfoDropdownItem ({ item }) {
  const { me } = useMe()
  const showModal = useShowModal()

  const onClick = () => {
    showModal((onClose) => {
      return (
        <div className={styles.details}>
          <div>id</div>
          <div>{item.id}</div>
          <div>created at</div>
          <div>{item.createdAt}</div>
          <div>cost</div>
          <div>{item.cost}</div>
          <div>sats</div>
          <div>{item.sats}</div>
          {me && (
            <>
              <div>sats from me</div>
              <div>{item.meSats}</div>
            </>
          )}
          <div>zappers</div>
          <div>{item.upvotes}</div>
        </div>
      )
    })
  }

  return (
    <Dropdown.Item onClick={onClick}>
      details
    </Dropdown.Item>
  )
}

function PaymentInfo ({ item, disableRetry, setDisableRetry }) {
  const { me } = useMe()
  const toaster = useToast()
  const retryCreateItem = useRetryCreateItem({ id: item.id })
  const waitForQrPayment = useQrPayment()
  const [disableInfoRetry, setDisableInfoRetry] = useState(disableRetry)
  if (item.deletedAt) return null

  const disableDualRetry = disableRetry || disableInfoRetry
  function setDisableDualRetry (value) {
    setDisableInfoRetry(value)
    setDisableRetry?.(value)
  }

  let Component
  let onClick
  if (me && item.invoice?.actionState && item.invoice?.actionState !== 'PAID') {
    if (item.invoice?.actionState === 'FAILED') {
      Component = () => <span className={classNames('text-warning', disableDualRetry && 'pulse')}>retry payment</span>
      onClick = async () => {
        if (disableDualRetry) return
        setDisableDualRetry(true)
        try {
          const { error } = await retryCreateItem({ variables: { invoiceId: parseInt(item.invoice?.id) } })
          if (error) throw error
        } catch (error) {
          toaster.danger(error.message)
        } finally {
          setDisableDualRetry(false)
        }
      }
    } else {
      Component = () => (
        <span
          className='text-info'
        >pending
        </span>
      )
      onClick = () => waitForQrPayment({ id: item.invoice?.id }, null, { cancelOnClose: false }).catch(console.error)
    }
  } else {
    return null
  }

  return (
    <>
      <span> \ </span>
      <span
        className='text-reset pointer fw-bold'
        onClick={onClick}
      >
        <Component />
      </span>
    </>
  )
}

function EditInfo ({ item, canEdit, setCanEdit, onEdit, editText, editThreshold }) {
  const router = useRouter()

  if (canEdit) {
    return (
      <>
        <span> \ </span>
        <span
          className='text-reset pointer fw-bold'
          onClick={() => onEdit ? onEdit() : router.push(`/items/${item.id}/edit`)}
        >
          <span>{editText || 'edit'} </span>
          {(!item.invoice?.actionState || item.invoice?.actionState === 'PAID')
            ? <Countdown
                date={editThreshold}
                onComplete={() => { setCanEdit(false) }}
              />
            : <span>10:00</span>}
        </span>
      </>
    )
  }

  return null
}
