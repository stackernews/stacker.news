import { AutocompleteList, AutocompleteGroupLabel, AutocompleteTiles, autocompleteStatusClasses } from '@/components/ui/autocomplete'
import { Autocomplete } from '@base-ui/react'
import { Row, Tile } from './items'
import Moon from '@/svgs/moon-fill.svg'

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
              <AutocompleteGroupLabel className='flex items-center gap-2'>
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
