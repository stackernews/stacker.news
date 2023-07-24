import AccordianItem from './accordian-item'
import Items from './items'
import { NavigateFooter } from './more-footer'

const LIMIT = 5

export default function PastBounties ({ item }) {
  const variables = {
    name: item.user.name,
    sort: 'user',
    type: 'bounties',
    limit: LIMIT
  }

  return (
    <AccordianItem
      header={<div className='fw-bold'>{item.user.name}'s bounties</div>}
      body={
        <Items
          variables={variables}
          Footer={props => <NavigateFooter {...props} href={`/${item.user.name}/bounties`} text='view all past bounties' />}
          filter={i => i.id !== item.id}
        />
      }
    />
  )
}
