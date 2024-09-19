import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useShowModal } from './modal'
import { useToast } from './toast'
import { Button, Dropdown, InputGroup } from 'react-bootstrap'
import { Form, InputUserSuggest, SubmitButton } from './form'
import { territoryTransferSchema } from '@/lib/validate'
import { useCallback } from 'react'
import Link from 'next/link'
import { useMe } from './me'

function TransferObstacle ({ sub, onClose, userName }) {
  const toaster = useToast()
  const [transfer] = useMutation(
    gql`
      mutation transferTerritory($subName: String!, $userName: String!) {
        transferTerritory(subName: $subName, userName: $userName) {
          name
          user {
            id
          }
        }
      }
    `
  )

  return (
    <div className='text-center'>
      Do you really want to transfer your territory
      <div>
        <Link href={`/~${sub.name}`}>~{sub.name}</Link>
        {' '}to{' '}
        <Link href={`/${userName}`}>@{userName}</Link>?
      </div>
      <div className='d-flex justify-center align-items-center mt-3 mx-auto'>
        <Button className='d-flex ms-auto mx-3' variant='danger' onClick={onClose}>cancel</Button>
        <Button
          className='d-flex me-auto mx-3' variant='success'
          onClick={
            async () => {
              try {
                await transfer({ variables: { subName: sub.name, userName } })
                onClose()
                toaster.success('transfer successful')
              } catch (err) {
                console.error(err)
                toaster.danger('failed to transfer')
              }
            }
          }
        >confirm
        </Button>
      </div>
    </div>
  )
}

function TerritoryTransferForm ({ sub, onClose }) {
  const showModal = useShowModal()
  const client = useApolloClient()
  const { me } = useMe()
  const schema = territoryTransferSchema({ me, client })

  const onSubmit = useCallback(async (values) => {
    showModal(onClose => <TransferObstacle sub={sub} onClose={onClose} {...values} />)
  }, [])

  return (
    <Form
      initial={{
        userName: ''
      }}
      schema={schema}
      onSubmit={onSubmit}
    >
      <h2 className='text-center'>transfer territory</h2>
      <div className='d-flex align-items-center mb-2'>
        <InputUserSuggest
          label='stacker'
          name='userName'
          prepend={<InputGroup.Text>@</InputGroup.Text>}
          showValid
          autoFocus
        />
      </div>
      <SubmitButton variant='success'>transfer</SubmitButton>
    </Form>
  )
}

export function TerritoryTransferDropdownItem ({ sub }) {
  const showModal = useShowModal()
  return (
    <Dropdown.Item onClick={async () =>
      showModal(onClose =>
        <TerritoryTransferForm sub={sub} onClose={onClose} />)}
    >
      transfer
    </Dropdown.Item>
  )
}
