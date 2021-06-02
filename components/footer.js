import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { Container } from 'react-bootstrap'
import { CopyInput } from './form'

export default function Footer () {
  const query = gql`
    {
      connectAddress
    }
  `

  const { data } = useQuery(query)

  return (
    <footer>
      {data &&
        <Container>
          <div
            className='d-flex align-items-center text-small my-3 mx-auto w-100'
            style={{ maxWidth: '500px' }}
          >
            <span className='nav-item text-muted mr-2'>connect:</span>
            <CopyInput
              size='sm'
              groupClassName='mb-0 w-100'
              readOnly
              placeholder={data.connectAddress}
            />
          </div>
        </Container>}
    </footer>
  )
}
