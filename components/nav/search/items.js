import { AutocompleteItem } from '@/components/ui/autocomplete'
import Link from 'next/link'
import SearchIcon from '@/svgs/search-line.svg'
import HistoryIcon from '@/svgs/history-line.svg'
import { MEDIA_URL } from '@/lib/constants'
import { cn } from '@/lib/cn'
import userStyles from '@/components/user-header.module.css'
import ItemPreviewCard from '@/components/item-preview-card'

// a row that runs the search. after is what comes after the text, like 'in ~bitcoin'
export function searchItem (href, text, after) {
  return { value: href, type: 'search', label: `search ${text} ${after}`.trim(), title: <>search <b>{text}</b> {after}</> }
}

function RowIcon ({ item }) {
  const iconProps = { width: 16, height: 16, className: 'text-muted shrink-0 self-center', 'aria-hidden': true }
  switch (item.type) {
    case 'recent':
      return <HistoryIcon {...iconProps} />
    case 'search':
      return <SearchIcon {...iconProps} />
    case 'user': {
      const src = item.photoId ? `${MEDIA_URL}/${item.photoId}` : '/dorian400.jpg'
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

export function Row ({ item, onPick }) {
  return (
    <AutocompleteItem
      value={item}
      render={<Link href={item.value} />}
      onClick={() => onPick(item)}
    >
      <RowIcon item={item} />
      {item.type === 'post'
        ? (
          <ItemPreviewCard id={item.id} side='right' className='flex flex-col grow min-w-0'>
            <RowText item={item} />
          </ItemPreviewCard>
          )
        : <RowText item={item} />}
    </AutocompleteItem>
  )
}
