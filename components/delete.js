import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import { useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Dropdown from 'react-bootstrap/Dropdown'
import { useShowModal } from './modal'
import { useToast } from './toast'

export default function Delete ({ itemId, children, onDelete, type = 'post', founder = false }) {
  const showModal = useShowModal()

  const [deleteItem] = useMutation(
    gql`
      mutation deleteItem($id: ID!) {
        deleteItem(id: $id) {
          text
          title
          url
          pollCost
          deletedAt
        }
      }`, {
      update (cache, { data: { deleteItem } }) {
        cache.modify({
          id: `Item:${itemId}`,
          fields: {
            text: () => deleteItem.text,
            title: () => deleteItem.title,
            url: () => deleteItem.url,
            pollCost: () => deleteItem.pollCost,
            deletedAt: () => deleteItem.deletedAt
          },
          optimistic: true
        })
      }
    }
  )
  return (
    <span
      className='pointer' onClick={() => {
        showModal(onClose => {
          return (
            <DeleteConfirm
              type={type}
              founder={founder}
              onConfirm={async () => {
                const { error } = await deleteItem({ variables: { id: itemId } })
                if (error) {
                  throw error
                }
                if (onDelete) {
                  onDelete()
                }
                onClose()
              }}
            />
          )
        })
      }}
    >{children}
    </span>
  )
}

export function DeleteConfirm ({ onConfirm, type, founder }) {
  const [error, setError] = useState()
  const toaster = useToast()

  return (
    <>
      {error && <Alert variant='danger' onClose={() => setError(undefined)} dismissible>{error}</Alert>}
      <p className='fw-bolder'>
        {founder
          ? `Are you sure? This will permanently delete this ${type.toLowerCase()} as the territory founder.`
          : 'Are you sure? This is a gone forever kind of delete.'}
      </p>
      <div className='d-flex justify-content-end'>
        <Button
          variant='danger' onClick={async () => {
            try {
              await onConfirm()
              toaster.success(founder
                ? `deleted ${type.toLowerCase()} as founder`
                : `deleted ${type.toLowerCase()}`)
            } catch (e) {
              setError(e.message || e)
            }
          }}
        >{founder ? 'delete as founder' : 'delete'}
        </Button>
      </div>
    </>
  )
}

export function DeleteDropdownItem (props) {
  const { founder } = props || {}
  return (
    <Delete {...props}>
      <Dropdown.Item>
        {founder ? 'delete as founder' : 'delete'}
      </Dropdown.Item>
    </Delete>
  )
}
