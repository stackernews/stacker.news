import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import { useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Dropdown from 'react-bootstrap/Dropdown'
import { useShowModal } from './modal'

export default function Delete ({ itemId, children, onDelete }) {
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
          }
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
              onConfirm={async () => {
                const { error } = await deleteItem({ variables: { id: itemId } })
                if (error) {
                  throw new Error({ message: error.toString() })
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

function DeleteConfirm ({ onConfirm }) {
  const [error, setError] = useState()

  return (
    <>
      {error && <Alert variant='danger' onClose={() => setError(undefined)} dismissible>{error}</Alert>}
      <p className='fw-bolder'>Are you sure? This is a gone forever kind of delete.</p>
      <div className='d-flex justify-content-end'>
        <Button
          variant='danger' onClick={async () => {
            try {
              await onConfirm()
            } catch (e) {
              setError(e.message || e)
            }
          }}
        >delete
        </Button>
      </div>
    </>
  )
}

export function DeleteDropdownItem (props) {
  return (
    <Delete {...props}>
      <Dropdown.Item>
        delete
      </Dropdown.Item>
    </Delete>
  )
}
