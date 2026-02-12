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
import DontLikeThisDropdownItem from './dont-link-this'
import BookmarkDropdownItem from './bookmark'
import SubscribeDropdownItem from './subscribe'
import { CopyLinkDropdownItem, CrosspostDropdownItem } from './share'
import Badges from './badge'
import { DEFAULT_POSTS_SATS_FILTER, DEFAULT_COMMENTS_SATS_FILTER } from '@/lib/constants'
import ActionDropdown from './action-dropdown'
import MuteDropdownItem from './mute'
import { DropdownItemUpVote } from './upvote'
import { useRoot } from './root'
import { MuteSubDropdownItem, PinSubDropdownItem } from './territory-header'
import UserPopover from './user-popover'
import useQrPayIn from './payIn/hooks/use-qr-pay-in'
import { useToast } from './toast'
import { useShowModal } from './modal'
import classNames from 'classnames'
import SubPopover from './sub-popover'
import useCanEdit from './use-can-edit'
import { useRetryPayIn } from './payIn/hooks/use-retry-pay-in'
import { willAutoRetryPayIn } from './payIn/hooks/use-auto-retry-pay-ins'

function itemTitle (item) {
  let title = ''
  title += numWithUnits(item.upvotes, {
    abbreviate: false,
    unitSingular: 'zapper',
    unitPlural: 'zappers'
  })
  if (item.sats - item.credits) {
    title += ` \\ ${numWithUnits(item.sats - item.credits, { abbreviate: false })} stacked`
  }
  if (item.boost) {
    title += ` \\ ${numWithUnits(item.boost, { abbreviate: false })} boost`
  }
  if (item.cost) {
    title += ` \\ ${numWithUnits(item.cost, { abbreviate: false })} cost`
  }
  if (item.downSats) {
    title += ` \\ ${numWithUnits(item.downSats, { abbreviate: false, unitSingular: 'downsat', unitPlural: 'downsats' })}`
  }
  if (item.credits) {
    title += ` \\ ${numWithUnits(item.credits, { abbreviate: false, unitSingular: 'CC', unitPlural: 'CCs' })}`
  }
  if (item.mine) {
    title += ` (${numWithUnits(item.meSats, { abbreviate: false })} to post)`
  } else if (item.meSats || item.meDontLikeSats || item.meAnonSats) {
    const satSources = []
    if (item.meAnonSats || (item.meSats || 0) - (item.meCredits || 0) > 0) {
      satSources.push(`${numWithUnits((item.meSats || 0) + (item.meAnonSats || 0) - (item.meCredits || 0), { abbreviate: false })}`)
    }
    if (item.meCredits) {
      satSources.push(`${numWithUnits(item.meCredits, { abbreviate: false, unitSingular: 'CC', unitPlural: 'CCs' })}`)
    }
    if (item.meDontLikeSats) {
      satSources.push(`${numWithUnits(item.meDontLikeSats, { abbreviate: false, unitSingular: 'downsat', unitPlural: 'downsats' })}`)
    }
    if (satSources.length) {
      title += ` (${satSources.join(' & ')} from me)`
    }
  }
  return title
}

export default function ItemInfo ({
  item, full, commentsText = 'comments',
  commentTextSingular = 'comment', className, embellishUser, extraInfo, edit, toggleEdit, editText,
  onQuoteReply, extraBadges, nested, pinnable, showActionDropdown = true, showUser = true,
  setDisableRetry, disableRetry, updatePayIn
}) {
  const { me } = useMe()
  const router = useRouter()
  const showModal = useShowModal()
  const [hasNewComments, setHasNewComments] = useState(false)
  const root = useRoot()
  // XXX sub controls pinning options for territory founders
  // so we only expose it if there's only one sub
  const subs = item?.subs || root?.subs
  const sub = subs?.length === 1 ? subs[0] : undefined
  const [canEdit, setCanEdit, editThreshold] = useCanEdit(item)

  useEffect(() => {
    if (!full) {
      setHasNewComments(newComments(item))
    }
  }, [item])

  // territory founders can pin any post in their territory
  // and OPs can pin any root reply in their post
  const isPost = !item.parentId
  const mySub = (me && sub && Number(me.id) === sub.userId)
  const myPost = (me && root && Number(me.id) === Number(root.user.id))
  const rootReply = item.path.split('.').length === 2
  const canPin = (isPost && mySub) || (myPost && rootReply)
  const isPinnedPost = isPost && item.position && (pinnable || !item.subNames)
  const isPinnedSubReply = !isPost && item.position && !item.subNames
  const meSats = (me ? item.meSats : item.meAnonSats) || 0
  const satsFilter = me
    ? (isPost ? me.privates?.postsSatsFilter : me.privates?.commentsSatsFilter)
    : (isPost ? DEFAULT_POSTS_SATS_FILTER : DEFAULT_COMMENTS_SATS_FILTER)
  const isDesperado = !item.mine && item.downSats > 0 &&
    satsFilter != null && (item.netInvestment ?? 0) < satsFilter

  return (
    <div className={className || `${styles.other}`}>
      {!isPinnedPost && !(isPinnedSubReply && !full) &&
        <>
          <span title={itemTitle(item)}>
            {numWithUnits(item.sats + item.boost + item.cost)}
          </span>
          <span> \ </span>
        </>}
      <Link
        href={`/items/${item.id}`} onClick={(e) => {
          const viewedAt = commentsViewedAt(item.id)
          if (viewedAt) {
            e.preventDefault()
            router.push(
              `/items/${item.id}?commentsViewedAt=${viewedAt}`,
              `/items/${item.id}`)
          }
        }} title={`${numWithUnits(item.commentSats + item.commentCost + item.commentBoost)} (${item.commentSats} stacked \\ ${item.commentCost} cost \\ ${item.commentBoost} boost)`} className='text-reset position-relative'
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
            <Badges badgeClassName='fill-grey' spacingClassName='ms-xs' height={12} width={12} user={item.user} bot={item.apiKey} />
            {embellishUser}
          </Link>}
        <span> </span>
        <Link href={`/items/${item.id}`} title={item.payIn?.payInStateChangedAt || item.createdAt} className='text-reset' suppressHydrationWarning>
          {timeSince(new Date(item.payIn?.payInStateChangedAt || item.createdAt))}
        </Link>
        {item.prior &&
          <>
            <span> \ </span>
            <Link href={`/items/${item.prior}`} className='text-reset'>
              yesterday
            </Link>
          </>}
      </span>
      {item.subNames?.map(subName => (
        <SubPopover key={subName} sub={subName}>
          <Link href={`/~${subName}`}>
            {' '}<Badge className={styles.newComment} bg={null}>{subName}</Badge>
          </Link>
        </SubPopover>
      ))}
      {sub?.nsfw &&
        <Badge className={styles.newComment} bg={null}>nsfw</Badge>}
      {item.freebie && !item.position &&
        <Link href='/new/freebies'>
          {' '}<Badge className={styles.newComment} bg={null}>freebie</Badge>
        </Link>}
      {isDesperado &&
        <span
          role='button' onClick={() => showModal((onClose) => <ItemDetails item={item} me={me} />)}
        >
          {' '}<Badge className={styles.newComment} bg={null}>-{abbrNum(item.downSats)} sats</Badge>
        </span>}
      {extraBadges}
      {
        showActionDropdown &&
          <>
            <EditInfo
              item={item} edit={edit} canEdit={canEdit}
              setCanEdit={setCanEdit} toggleEdit={toggleEdit} editText={editText} editThreshold={editThreshold}
            />
            {item.payIn && <PayInInfo item={item} updatePayIn={updatePayIn} disableRetry={disableRetry} setDisableRetry={setDisableRetry} />}
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
              {me && !item.mine && !item.deletedAt &&
            (item.meDontLikeSats > meSats
              ? <DropdownItemUpVote item={item} />
              : <DontLikeThisDropdownItem item={item} />)}
              {item.mine && item.payIn?.id &&
                <>
                  <hr className='dropdown-divider' />
                  <Link href={`/transactions/${item.payIn?.id}`} className='text-reset dropdown-item'>
                    view payment
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

function ItemDetails ({ item, me }) {
  return (
    <div className={styles.details}>
      <div className={styles.detailsSection}>item</div>
      <div className={styles.detailsLabel}>id</div>
      <div className={styles.detailsValue}>{item.id}</div>
      <div className={styles.detailsLabel}>created at</div>
      <div className={styles.detailsValue}>{item.createdAt}</div>
      {item.payIn?.payInState === 'PAID' &&
        <>
          <div className={styles.detailsLabel}>paid at</div>
          <div className={styles.detailsValue}>{item.payIn?.payInStateChangedAt}</div>
        </>}
      <div className={styles.detailsSection}>this item</div>
      <div className={styles.detailsLabel}>zappers</div>
      <div className={styles.detailsValue}>{item.upvotes}</div>
      <div className={styles.detailsLabel}>cost</div>
      <div className={styles.detailsValue}>{item.cost} sats</div>
      <div className={styles.detailsLabel}>boost</div>
      <div className={styles.detailsValue}>{item.boost} sats</div>
      <div className={styles.detailsLabel}>stacked</div>
      <div className={styles.detailsValue}>{item.sats - item.credits} sats / {item.credits} ccs</div>
      <div className={styles.detailsLabel}>downsats</div>
      <div className={styles.detailsValue}>{item.downSats} sats</div>
      <div className={styles.detailsLabel}>invested</div>
      <div className={styles.detailsValue}>{item.sats + item.boost + item.cost} sats</div>
      <div className={styles.detailsSection}>comments</div>
      <div className={styles.detailsLabel}>cost</div>
      <div className={styles.detailsValue}>{item.commentCost} sats</div>
      <div className={styles.detailsLabel}>boost</div>
      <div className={styles.detailsValue}>{item.commentBoost} sats</div>
      <div className={styles.detailsLabel}>stacked</div>
      <div className={styles.detailsValue}>{item.commentSats - item.commentCredits} sats / {item.commentCredits} ccs</div>
      <div className={styles.detailsLabel}>downsats</div>
      <div className={styles.detailsValue}>{item.commentDownSats} sats</div>
      <div className={styles.detailsLabel}>invested</div>
      <div className={styles.detailsValue}>{item.commentSats + item.commentCost + item.commentBoost} sats</div>
      {me && (
        <>
          <div className={styles.detailsSection}>from me</div>
          <div className={styles.detailsLabel}>zapped</div>
          <div className={styles.detailsValue}>{item.meSats - item.meCredits} sats / {item.meCredits} ccs</div>
          <div className={styles.detailsLabel}>downzapped</div>
          <div className={styles.detailsValue}>{item.meDontLikeSats} sats</div>
        </>
      )}
    </div>
  )
}

function InfoDropdownItem ({ item }) {
  const { me } = useMe()
  const showModal = useShowModal()

  return (
    <Dropdown.Item onClick={() => showModal(() => <ItemDetails item={item} me={me} />)}>
      details
    </Dropdown.Item>
  )
}

export function PayInInfo ({ item, updatePayIn, disableRetry, setDisableRetry }) {
  const { me } = useMe()
  const toaster = useToast()
  const retryPayIn = useRetryPayIn(item.payIn.id, { update: updatePayIn, onRetry: updatePayIn, protocolLimit: 1 })
  const waitForQrPayIn = useQrPayIn()
  const [disableInfoRetry, setDisableInfoRetry] = useState(disableRetry)
  if (item.deletedAt) return null

  const disableDualRetry = disableRetry || disableInfoRetry
  function setDisableDualRetry (value) {
    setDisableInfoRetry(value)
    setDisableRetry?.(value)
  }

  let Component
  let onClick
  if (me && item.payIn?.payInState !== 'PAID' && item.payIn?.payerPrivates) {
    // are we automatically retrying?
    if (willAutoRetryPayIn(item.payIn)) {
      Component = () => <span className={classNames('text-info')}>pending</span>
    } else if (item.payIn.payInState === 'FAILED') {
      Component = () => <span className={classNames('text-warning', disableDualRetry ? 'pulse' : 'pointer')}>retry payment</span>
      onClick = async () => {
        if (disableDualRetry) return
        setDisableDualRetry(true)
        try {
          const { error } = await retryPayIn()
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
          className='text-info pointer'
        >pending
        </span>
      )
      onClick = () => waitForQrPayIn(item.payIn, null, { cancelOnClose: false }).catch(console.error)
    }
  } else {
    return null
  }

  return (
    <>
      <span> \ </span>
      <span
        className='text-reset fw-bold'
        onClick={onClick}
      >
        <Component />
      </span>
    </>
  )
}

function EditInfo ({ item, edit, canEdit, setCanEdit, toggleEdit, editText, editThreshold }) {
  const router = useRouter()

  if (canEdit) {
    return (
      <>
        <span> \ </span>
        <span
          className='text-reset pointer fw-bold font-monospace'
          onClick={() => toggleEdit ? toggleEdit() : router.push(`/items/${item.id}/edit`)}
        >
          <span>{editText || 'edit'} </span>
          {(!item.payIn?.payInState || item.payIn?.payInState === 'PAID')
            ? <Countdown
                date={editThreshold}
                onComplete={() => { setCanEdit(false) }}
              />
            : <span>10:00</span>}
        </span>
      </>
    )
  }

  if (edit && !canEdit) {
    // if we're still editing after timer ran out
    return (
      <>
        <span> \ </span>
        <span
          className='text-reset pointer fw-bold font-monospace'
          onClick={() => toggleEdit ? toggleEdit() : router.push(`/items/${item.id}`)}
        >
          <span>cancel </span>
          <span>00:00</span>
        </span>
      </>
    )
  }

  return null
}
