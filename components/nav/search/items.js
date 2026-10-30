import { AutocompleteItem, AutocompleteTile } from '@/components/ui/autocomplete'
import Link from 'next/link'
import SearchIcon from '@/svgs/search-line.svg'
import HistoryIcon from '@/svgs/history-line.svg'
import ScopeArrow from '@/svgs/arrow-left-up-line.svg'
import { cn } from '@/lib/cn'
import userStyles from '@/components/user-header.module.css'
import { abbrNum, numWithUnits } from '@/lib/format'
import { searchHref } from '@/lib/search'
import { SubPreviewTrigger } from '@/components/sub-preview-card'
import styles from './search.module.css'
import { avatarSrc } from '@/lib/user'
import { keepFocus, scopeHint } from './bar'

export function searchItem (href, text, after) {
  return { value: href, type: 'search', label: `search ${text} ${after}`.trim(), text, after }
}

// links to the search without the filters of the page we're on
export function recentItem (q) {
  return { value: searchHref(q), type: 'recent', label: q }
}

// stackers can hide what they stacked, and only the top territories come with it
function stackedMeta ({ optional }) {
  return optional?.stacked != null ? `${abbrNum(optional.stacked)} stacked` : ''
}

export function userItem (user) {
  return {
    value: `/${user.name}`,
    type: 'user',
    name: user.name,
    label: `@${user.name}`,
    photoId: user.photoId,
    meta: stackedMeta(user)
  }
}

export function subItem (sub) {
  return {
    value: `/~${sub.name}`,
    type: 'sub',
    name: sub.name,
    label: `~${sub.name}`,
    meta: stackedMeta(sub),
    muted: sub.meMuteSub
  }
}

// a quiet week still fills the line so every long tile has the same height
function weekMeta (sub, week) {
  const activity = week?.nitems > 0
    ? `${numWithUnits(week.nitems, { unitSingular: 'item', unitPlural: 'items' })} this week`
    : 'quiet this week'
  return sub.meSubscription ? `subscribed \\ ${activity}` : activity
}

export function longSubItem (sub, week) {
  return { ...subItem(sub), meta: weekMeta(sub, week) }
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

export function Row ({ item, onPick, onScope }) {
  return (
    <AutocompleteItem
      value={item}
      render={<Link href={item.value} />}
      onClick={() => onPick(item)}
      className={onScope && 'pe-(--scope-width)'}
      action={onScope && <ScopeButton item={item} onScope={onScope} />}
    >
      <RowIcon item={item} />
      <span className='grow min-w-0 truncate'>
        {item.type === 'search' ? <>search <b>{item.text}</b> {item.after}</> : item.label}
      </span>
      {item.meta && <span className='shrink-0 text-xs text-muted'>{item.meta}</span>}
    </AutocompleteItem>
  )
}

export function Tile ({ item, onPick, onScope, previewHandle }) {
  const textClassName = cn('flex flex-col gap-0.5 min-w-0 py-2.5 px-3', onScope && 'pe-(--scope-width)')
  const text = (
    <>
      <span className='truncate text-sm font-bold'>{item.label}</span>
      <span className='text-xs text-muted'>{item.meta}</span>
    </>
  )

  return (
    <AutocompleteTile
      value={item}
      render={<Link href={item.value} />}
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
