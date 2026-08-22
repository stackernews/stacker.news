import { useMutation } from '@apollo/client/react'
import { gql } from 'graphql-tag'
import { useState } from 'react'
import { Alert } from '@/components/ui/alert'
import Button from '@/components/ui/button'
import { MenuItem } from '@/components/ui/menu'
import { useShowModal } from './modal'
import { useToast } from '@/components/ui/toast'

/* the confirm-open lives in a hook so the handler can sit on the activating
   element itself: Delete's span hears bubbled clicks from in-tree children like
   post.js's Button, but a portaled MenuItem is no DOM descendant, so mouse
   worked only through React's synthetic portal bubbling and Enter never arrived */
export function useDeleteConfirm ({ itemId, onDelete, type = 'post' }) {
  const showModal = useShowModal()

  const [deleteItem] = useMutation(
    gql`
      mutation deleteItem($id: ID!) {
        deleteItem(id: $id) {
          id
          text
          title
          url
          pollCost
          deletedAt
          lexicalState
          html
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
            deletedAt: () => deleteItem.deletedAt,
            // the body renders from the resolver-derived lexicalState and html
            // (item-full's Lexical read path), not text, so they must repaint too
            lexicalState: () => deleteItem.lexicalState,
            html: () => deleteItem.html
          },
          optimistic: true
        })
      }
    }
  )

  return () => {
    showModal(onClose => {
      return (
        <DeleteConfirm
          type={type}
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
  }
}

export default function Delete ({ itemId, children, onDelete, type = 'post' }) {
  const showDeleteConfirm = useDeleteConfirm({ itemId, onDelete, type })
  return (
    <span className='pointer' onClick={showDeleteConfirm}>{children}</span>
  )
}

export function DeleteConfirm ({ onConfirm, type }) {
  const [error, setError] = useState()
  const toaster = useToast()

  return (
    <>
      {error && <Alert variant='danger' onClose={() => setError(undefined)} dismissible>{error}</Alert>}
      <p className='font-bolder'>Are you sure? This is a gone forever kind of delete.</p>
      <div className='flex justify-end'>
        <Button
          variant='danger' onClick={async () => {
            try {
              await onConfirm()
              toaster.success(`deleted ${type.toLowerCase()}`)
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
  const showDeleteConfirm = useDeleteConfirm(props)
  return (
    <MenuItem onClick={showDeleteConfirm}>
      delete
    </MenuItem>
  )
}
