import { RELATED_ITEMS } from '@/fragments/items'
import AccordionItem from './accordion-item'
import Items from './items'
import { NavigateFooter } from './more-footer'

const LIMIT = 5

export default function Related ({ item, compact = false, ...props }) {
  if (item.position || !item.subNames?.length || item.isJob || item.parentId || item.deletedAt || item.bounty > 0) return null

  const variables = { title: item.title, id: item.id, limit: LIMIT }
  return (
    <AccordionItem
      keepMounted // need to preserve pending zaps while collapsed
      header={<div className='font-bold'>related posts</div>}
      body={
        <Items
          compact={compact}
          query={RELATED_ITEMS}
          variables={variables}
          destructureData={data => data.related}
          Footer={props => <NavigateFooter {...props} href={`/items/${item.id}/related`} text='view all related items' />}
        />
      }
      {...props}
    />
  )
}
