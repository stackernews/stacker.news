import { AutocompleteList, AutocompleteGroupLabel, AutocompleteTiles, autocompleteStatusClasses } from '@/components/ui/autocomplete'
import { Autocomplete } from '@base-ui/react'
import Link from 'next/link'
import { Row, Tile } from './items'
import { keepFocus } from './bar'
import Moon from '@/svgs/moon-fill.svg'

// a button or a link at the end of a group's label
function GroupAction ({ label, onClick, href, onPick }) {
  const className = 'ms-auto text-reset pointer-coarse:hitbox-11'
  if (href) {
    return <Link href={href} className={className} onMouseDown={keepFocus} onClick={onPick}>{label}</Link>
  }
  return <button type='button' className={className} onMouseDown={keepFocus} onClick={onClick}>{label}</button>
}

export function Results ({ searching, loading, onPick }) {
  return (
    <>
      <Autocomplete.Status>
        {searching && <div className={autocompleteStatusClasses()}>searching…</div>}
      </Autocomplete.Status>
      <AutocompleteList>
        {group => (
          <Autocomplete.Group key={group.value} items={group.items} className='not-first:mt-1.5'>
            {group.label && (
              <AutocompleteGroupLabel
                className='flex items-center gap-2'
                action={group.action && <GroupAction {...group.action} onPick={onPick} />}
              >
                {group.label}
                {loading && <Moon className='spin shrink-0' width={12} height={12} aria-hidden />}
              </AutocompleteGroupLabel>
            )}
            {group.layout === 'tiles'
              ? (
                <AutocompleteTiles className='grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]'>
                  <Autocomplete.Collection>
                    {item => <Tile key={item.value} item={item} onPick={onPick} />}
                  </Autocomplete.Collection>
                </AutocompleteTiles>
                )
              : (
                <Autocomplete.Collection>
                  {item => <Row key={item.value} item={item} onPick={onPick} />}
                </Autocomplete.Collection>
                )}
          </Autocomplete.Group>
        )}
      </AutocompleteList>
    </>
  )
}
