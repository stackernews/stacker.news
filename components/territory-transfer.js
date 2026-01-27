import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useShowModal } from './modal'
import { ObstacleButtons } from './obstacle'
import { useToast } from './toast'
import { Dropdown, InputGroup } from 'react-bootstrap'
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

  const handleConfirm = async () => {
    try {
      await transfer({ variables: { subName: sub.name, userName } })
      onClose()
      toaster.success('transfer successful')
    } catch (err) {
      console.error(err)
      toaster.danger('failed to transfer')
    }
  }

  return (
    <div className='text-center'>
      <p>Do you really want to transfer your territory</p>
      <div>
        <Link href={`/~${sub.name}`}>~{sub.name}</Link>
        {' '}to{' '}
        <Link href={`/${userName}`}>@{userName}</Link>?
      </div>
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='confirm' confirmVariant='success' />
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
  }, [showModal, sub])

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
