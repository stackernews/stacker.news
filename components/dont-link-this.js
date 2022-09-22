import { gql, useMutation } from '@apollo/client'
import { Dropdown } from 'react-bootstrap'
import MoreIcon from '../svgs/more-fill.svg'
import { useFundError } from './fund-error'

export default function DontLikeThis ({ id }) {
  const { setError } = useFundError()

  const [dontLikeThis] = useMutation(
    gql`
      mutation dontLikeThis($id: ID!) {
        dontLikeThis(id: $id)
      }`, {
      update (cache) {
        cache.modify({
          id: `Item:${id}`,
          fields: {
            meDontLike () {
              return true
            }
          }
        })
      }
    }
  )

  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle variant='success' id='dropdown-basic' as='a'>
        <MoreIcon className='fill-grey ml-1' height={16} width={16} />
      </Dropdown.Toggle>

      <Dropdown.Menu>
        <Dropdown.Item
          className='text-center'
          onClick={async () => {
            try {
              await dontLikeThis({
                variables: { id },
                optimisticResponse: { dontLikeThis: true }
              })
            } catch (error) {
              if (error.toString().includes('insufficient funds')) {
                setError(true)
              }
            }
          }}
        >
          flag
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}
