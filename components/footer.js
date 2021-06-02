import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
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
      {data
        ? (
          <div className='d-flex align-items-center text-small my-3'>
            <span className='nav-item text-muted mr-2'>connect:</span>
            <CopyInput
              size='sm'
              groupClassName='mb-0'
              readOnly
              placeholder={data.connectAddress}
            />
          </div>
          )
        : 'loading'}
    </footer>
  )
}
