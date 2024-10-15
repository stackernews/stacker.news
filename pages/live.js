import Button from 'react-bootstrap/Button'
import { CenterLayout } from '@/components/layout'
import Snl from '@/components/snl'
import { gql } from 'graphql-tag'
import { useMutation, useQuery } from '@apollo/client'
import { getGetServerSideProps } from '@/api/ssrApollo'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

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

  const { data } = useQuery(gql`{ snl }`)

  return (
    <CenterLayout>
      <Snl />
      <Button variant={data?.snl ? 'primary' : 'danger'} onClick={toggle}>go: {data?.snl ? 'off' : 'on'} air</Button>
    </CenterLayout>
  )
}
