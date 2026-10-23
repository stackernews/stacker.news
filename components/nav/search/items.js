import { AutocompleteItem, AutocompleteTile } from '@/components/ui/autocomplete'
import Link from 'next/link'
import SearchIcon from '@/svgs/search-line.svg'
import HistoryIcon from '@/svgs/history-line.svg'
import ScopeArrow from '@/svgs/arrow-left-up-line.svg'
import { cn } from '@/lib/cn'
import userStyles from '@/components/user-header.module.css'
import { abbrNum } from '@/lib/format'
import { searchHref } from '@/lib/search'
import SubPreviewCard from '@/components/sub-preview-card'
import styles from './search.module.css'
import { avatarSrc } from '@/lib/user'
import { keepFocus } from './bar'
import { scopeHint } from './lookup'

// a row that runs the search. after is what comes after the text, like 'in ~bitcoin'
export function searchItem (href, text, after) {
  return { value: href, type: 'search', label: `search ${text} ${after}`.trim(), title: <>search <b>{text}</b> {after}</> }
}

// a recent search, without the filters of the page we're on
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
    meta: user.optional?.stacked != null ? `${abbrNum(user.optional.stacked)} stacked` : ''
  }
}

export function subItem (sub) {
  return {
    value: `/~${sub.name}`,
    type: 'sub',
    name: sub.name,
    label: `~${sub.name}`,
    // only the top territories come with what they stacked
    meta: sub.optional?.stacked != null ? `${abbrNum(sub.optional.stacked)} stacked` : '',
    muted: sub.meMuteSub
  }
}

function RowIcon ({ item }) {
  const iconProps = { width: 16, height: 16, className: 'fill-muted shrink-0 self-center', 'aria-hidden': true }
  switch (item.type) {
    case 'recent':
      return <HistoryIcon {...iconProps} />
    case 'search':
      return <SearchIcon {...iconProps} />
    case 'user': {
      const src = avatarSrc(item.photoId)
      return <img src={src} alt='' width={16} height={16} className={cn(userStyles.userimg, 'shrink-0 self-center')} />
    }
    default:
      return null
  }
}

function RowText ({ item }) {
  return (
    <>
      <span className='grow min-w-0 truncate'>{item.title ?? item.label}</span>
      {item.meta && <span className='shrink-0 text-xs text-muted'>{item.meta}</span>}
    </>
  )
}

// makes the row's stacker or territory a chip. its width is --scope, set on the list
function ScopeButton ({ item, onScope }) {
  const label = scopeHint(item)
  return (
    <button
      type='button'
      tabIndex={-1}
      aria-label={label}
      title={label}
      className={cn(styles.scope, 'absolute inset-y-0 end-0 w-(--scope) flex items-center justify-center')}
      onMouseDown={keepFocus}
      onClick={() => onScope(item)}
    >
      <ScopeArrow width={16} height={16} aria-hidden />
    </button>
  )
}

// onScope gives the row an arrow button
export function Row ({ item, onPick, onScope }) {
  return (
    <AutocompleteItem
      value={item}
      render={<Link href={item.value} />}
      onClick={() => onPick(item)}
      className={onScope && 'pe-(--scope)'}
      action={onScope && <ScopeButton item={item} onScope={onScope} />}
    >
      <RowIcon item={item} />
      <RowText item={item} />
    </AutocompleteItem>
  )
}

// a territory. onScope gives it an arrow button
export function Tile ({ item, onPick, onScope }) {
  return (
    <AutocompleteTile
      value={item}
      render={<Link href={item.value} />}
      onClick={() => onPick(item)}
      className={item.muted && styles.muted}
      action={onScope && <ScopeButton item={item} onScope={onScope} />}
    >
      {/* the padding is on the preview card so hovering anywhere on the tile opens it */}
      <SubPreviewCard sub={item.name} triggerClassName={cn('flex flex-col gap-0.5 min-w-0 py-2.5 px-3', onScope && 'pe-(--scope)')}>
        <span className='truncate text-sm font-bold'>{item.label}</span>
        <span className='text-xs text-muted'>{item.meta}</span>
      </SubPreviewCard>
    </AutocompleteTile>
  )
}
