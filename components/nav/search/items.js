import { AutocompleteItem, AutocompleteTile } from '@/components/ui/autocomplete'
import Link from 'next/link'
import SearchIcon from '@/svgs/search-line.svg'
import HistoryIcon from '@/svgs/history-line.svg'
import ScopeArrow from '@/svgs/arrow-left-up-line.svg'
import { cn } from '@/lib/cn'
import userStyles from '@/components/user-header.module.css'
import removeMd from 'remove-markdown'
import { abbrNum, numWithUnits } from '@/lib/format'
import { searchHref } from '@/lib/search'
import { SubPreviewTrigger } from '@/components/sub-preview-card'
import SearchHighlight from '@/components/search-highlight'
import styles from './search.module.css'
import { avatarSrc } from '@/lib/user'
import { timeSince } from '@/lib/time'
import { keepFocus, scopeHint } from './bar'

export function searchItem (href, text, after) {
  return { value: href, type: 'search', label: `search ${text} ${after}`.trim(), text, after }
}

// links to the search without the filters of the page we're on
export function recentItem (q) {
  return { value: searchHref(q), type: 'recent', label: q }
}

export function userItem (user) {
  return {
    value: `/${user.name}`,
    type: 'user',
    name: user.name,
    label: `@${user.name}`,
    photoId: user.photoId,
    // stackers can hide what they stacked
    meta: user.optional.stacked !== null ? `${abbrNum(user.optional.stacked)} stacked` : ''
  }
}

export function subItem (sub) {
  return {
    value: `/~${sub.name}`,
    type: 'sub',
    name: sub.name,
    label: `~${sub.name}`,
    muted: sub.meMuteSub
  }
}

// a description of just an image or a link reference has no text left
function plainDesc (sub) {
  return sub.desc ? removeMd(sub.desc).trim() : ''
}

// a quiet week still fills the line so every long tile has the same height
function weekActivity (week) {
  return week?.nitems > 0
    ? `${numWithUnits(week.nitems, { unitSingular: 'item', unitPlural: 'items' })} this week`
    : 'quiet this week'
}

export function longSubItem (sub, week) {
  const about = plainDesc(sub) || weekActivity(week)
  return { ...subItem(sub), meta: sub.meSubscription ? `subscribed \\ ${about}` : about }
}

export function weekSubItem (sub) {
  return { ...subItem(sub), meta: numWithUnits(sub.nitems, { unitSingular: 'item', unitPlural: 'items' }) }
}

export function hitItem (type, hit) {
  return {
    value: `/items/${hit.itemId}`,
    type,
    label: hit.text.replaceAll('***', ''),
    marked: hit.text,
    author: hit.userName,
    sats: numWithUnits(hit.sats),
    comments: hit.ncomments > 0 && numWithUnits(hit.ncomments, { abbreviate: false, unitSingular: 'comment', unitPlural: 'comments' }),
    date: timeSince(new Date(hit.createdAt)),
    subs: hit.subNames.map(subName => `~${subName}`).join(' ')
  }
}

function RowIcon ({ item }) {
  if (item.type === 'user') {
    return <img src={avatarSrc(item.photoId)} alt='' width={16} height={16} className={cn(userStyles.userimg, 'shrink-0 self-center')} />
  }
  const Icon = item.type === 'recent' ? HistoryIcon : SearchIcon
  return <Icon width={16} height={16} className='fill-muted shrink-0 self-center' aria-hidden />
}

function ScopeButton ({ item, onScope }) {
  const label = scopeHint(item)
  return (
    <button
      type='button'
      tabIndex={-1}
      aria-label={label}
      title={label}
      className={cn(styles.scope, 'absolute inset-y-0 end-0 w-(--scope-width) flex items-center justify-center')}
      onMouseDown={keepFocus}
      onClick={() => onScope(item)}
    >
      <ScopeArrow width={16} height={16} aria-hidden />
    </button>
  )
}

function HitAuthor ({ name }) {
  return name && <span className={styles.bodySecondary}>@{name} </span>
}

function PostHit ({ item }) {
  return (
    <>
      <span className='flex items-baseline gap-4'>
        <span className='grow min-w-0 font-medium max-md:line-clamp-2 md:truncate'><SearchHighlight text={item.marked} /></span>
        <span className={cn(styles.meta, 'shrink-0 text-xs')}>{item.sats}</span>
      </span>
      <span className={cn(styles.meta, 'truncate text-xs')}>
        <HitAuthor name={item.author} />{item.date} {item.subs}{item.comments && ` \\ ${item.comments}`}
      </span>
    </>
  )
}

function CommentHit ({ item }) {
  return (
    <>
      <span className={cn(styles.meta, 'flex items-baseline gap-4 text-xs')}>
        <span className='grow min-w-0 truncate'><HitAuthor name={item.author} />{item.date}</span>
        <span className='shrink-0'>{item.sats}</span>
      </span>
      {/* keeps the text out of the sats column */}
      <span className={cn(styles.bodySecondary, 'line-clamp-2 md:pe-24')}><SearchHighlight text={item.marked} /></span>
    </>
  )
}

function HitRow ({ item, onPick }) {
  const Hit = item.type === 'comment' ? CommentHit : PostHit

  return (
    <AutocompleteItem
      value={item}
      render={<Link href={item.value} prefetch={false} />}
      onClick={() => onPick(item)}
      className={cn(styles.hit, 'flex-col items-stretch gap-0 py-1')}
    >
      <Hit item={item} />
    </AutocompleteItem>
  )
}

export function Row ({ item, onPick, onScope }) {
  if (item.marked) return <HitRow item={item} onPick={onPick} />

  return (
    <AutocompleteItem
      value={item}
      render={<Link href={item.value} prefetch={false} />}
      onClick={() => onPick(item)}
      className={onScope && 'pe-(--scope-width)'}
      action={onScope && <ScopeButton item={item} onScope={onScope} />}
    >
      <RowIcon item={item} />
      <span className='grow min-w-0 truncate'>
        {item.type === 'search' ? <>search <b>{item.text}</b> {item.after}</> : item.label}
      </span>
      {item.meta && <span className={cn(styles.meta, 'shrink-0 text-xs')}>{item.meta}</span>}
    </AutocompleteItem>
  )
}

export function Tile ({ item, onPick, onScope, previewHandle }) {
  const textClassName = cn('flex flex-col min-w-0 py-2 px-3', onScope && 'pe-(--scope-width)')
  const text = (
    <>
      <span className='truncate font-medium'>{item.label}</span>
      <span className={cn(styles.meta, 'truncate text-xs')}>{item.meta}</span>
    </>
  )

  return (
    <AutocompleteTile
      value={item}
      render={<Link href={item.value} prefetch={false} />}
      onClick={() => onPick(item)}
      className={item.muted && styles.muted}
      action={onScope && <ScopeButton item={item} onScope={onScope} />}
    >
      {previewHandle
        ? (
          // the padding is on the trigger so hovering anywhere on the tile opens the card
          <SubPreviewTrigger handle={previewHandle} payload={item.name} sub={item.name} className={textClassName}>
            {text}
          </SubPreviewTrigger>
          )
        : <span className={textClassName}>{text}</span>}
    </AutocompleteTile>
  )
}
