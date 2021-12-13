import { InputGroup, Modal } from 'react-bootstrap'
import React, { useState, useCallback, useContext, useRef, useEffect } from 'react'
import * as Yup from 'yup'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'

export const ItemActContext = React.createContext({
  item: null,
  setItem: () => {}
})

export function ItemActProvider ({ children }) {
  const [item, setItem] = useState(null)

  const contextValue = {
    item,
    setItem: useCallback(i => setItem(i), [])
  }

  return (
    <ItemActContext.Provider value={contextValue}>
      {children}
    </ItemActContext.Provider>
  )
}

export function useItemAct () {
  const { item, setItem } = useContext(ItemActContext)
  return { item, setItem }
}

export const ActSchema = Yup.object({
  amount: Yup.number().typeError('must be a number').required('required')
    .positive('must be positive').integer('must be whole')
})

export function ItemActModal () {
  const { item, setItem } = useItemAct()
  const inputRef = useRef(null)
  const me = useMe()

  useEffect(() => {
    inputRef.current?.focus()
  }, [item])

  return (
    <Modal
      show={!!item}
      onHide={() => {
        setItem(null)
      }}
    >
      <Modal.Body>
        <Form
          initial={{
            amount: me?.tipDefault,
            default: false
          }}
          schema={ActSchema}
          onSubmit={async ({ amount, tipDefault, submit }) => {
            await item.act({
              variables: {
                id: item.itemId,
                act: submit,
                sats: Number(amount),
                tipDefault
              }
            })
            await item.strike()
            setItem(null)
          }}
        >
          <Input
            label='amount'
            name='amount'
            innerRef={inputRef}
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <div className='d-flex'>
            <SubmitButton variant='success' className='ml-auto mt-1 px-4' value='TIP'>tip</SubmitButton>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
