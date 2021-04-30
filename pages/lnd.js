import { gql, useMutation, useQuery } from '@apollo/client'
import { Button } from 'react-bootstrap'
import Layout from '../components/layout'

export default function Index () {
  const [createAccount] = useMutation(gql`
    mutation {
      createAccount
    }`)
  const { data } = useQuery(gql`
  {
    accounts
  }`)
  return (
    <Layout>
      <Button onClick={createAccount}>create account</Button>
      {data && data.accounts.map(account =>
        <div key={account}>account</div>
      )}
    </Layout>
  )
}
