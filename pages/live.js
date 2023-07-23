import { Button } from 'react-bootstrap'
import LayoutCenter from '../components/layout-center'
import Snl from '../components/snl'
import { gql } from 'apollo-server-micro'
import { useMutation, useQuery } from '@apollo/client'

export default function Index () {
  const [toggle] = useMutation(
    gql`
      mutation onAirToggle {
        onAirToggle
      }`, {
      update (cache, { data: { onAirToggle } }) {
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            snl: () => onAirToggle
          }
        })
      }
    }
  )

  const { data } = useQuery(gql`{ snl }`, {
    fetchPolicy: 'cache-only'
  })

  return (
    <LayoutCenter>
      <Snl />
      <Button variant={data?.snl ? 'primary' : 'danger'} onClick={toggle}>go: {data?.snl ? 'off' : 'on'} air</Button>
    </LayoutCenter>
  )
}
