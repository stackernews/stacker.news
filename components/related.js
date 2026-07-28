import { RELATED_ITEMS } from '@/fragments/items'
import AccordionItem from './accordion-item'
import Items from './items'
import { NavigateFooter } from './more-footer'

const LIMIT = 5

export default function Related ({ title, itemId, ...props }) {
  const variables = { title, id: itemId, limit: LIMIT }
  return (
    <AccordionItem
      header={<div className='font-bold'>related posts</div>}
      body={
        <Items
          query={RELATED_ITEMS}
          variables={variables}
          destructureData={data => data.related}
          Footer={props => <NavigateFooter {...props} href={`/items/${itemId}/related`} text='view all related items' />}
        />
      }
      {...props}
    />
  )
}
