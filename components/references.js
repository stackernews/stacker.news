import { ITEM_REFERENCES } from '@/fragments/items'
import AccordianItem from './accordian-item'
import Items from './items'
import { NavigateFooter } from './more-footer'

const LIMIT = 5

export default function References ({ itemId, ...props }) {
  const variables = { id: itemId, limit: LIMIT }
  return (
    <AccordianItem
      header={<div className='fw-bold'>referenced by</div>}
      body={
        <Items
          query={ITEM_REFERENCES}
          variables={variables}
          destructureData={data => data.references}
          Footer={props => <NavigateFooter {...props} href={`/items/${itemId}/references`} text='view all references' noMoreText='no references' />}
        />
      }
      {...props}
    />
  )
}
