import { AutocompleteList } from '@/components/ui/autocomplete'
import { Autocomplete } from '@base-ui/react'
import { Row } from './items'

export function Results ({ lookup, onPick }) {
  return (
    <>
      <AutocompleteList>
        {(group, index) => (
          <Autocomplete.Group key={group.value} items={group.items} className={index > 0 ? 'mt-1.5' : undefined}>
            <Autocomplete.Collection>
              {item => <Row key={item.value} item={item} onPick={onPick} />}
            </Autocomplete.Collection>
          </Autocomplete.Group>
        )}
      </AutocompleteList>
    </>
  )
}
