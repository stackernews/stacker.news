import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import LayoutCenter from '../../components/layout-center'

export async function getServerSideProps ({ params: { id } }) {
  return {
    props: {
      id
    }
  }
}

export default function Withdrawl ({ id }) {
  const query = gql`
    {
      withdrawl(id: ${id}) {
        bolt11
      }
    }`
  return (
    <LayoutCenter>
      <LoadWithdrawl query={query} />
    </LayoutCenter>
  )
}

function LoadWithdrawl ({ query }) {
  const { loading, error, data } = useQuery(query, { pollInterval: 1000 })
  if (error) return <div>error</div>
  if (!data || loading) {
    return <div>withdrawl loading</div>
  }

  return <div>hi</div>
}
