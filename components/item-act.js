import { Accordion, InputGroup, Modal } from 'react-bootstrap'
import React, { useState, useCallback, useContext, useRef, useEffect } from 'react'
import * as Yup from 'yup'
import { Form, Input, SubmitButton } from './form'
import ArrowRight from '../svgs/arrow-right-s-fill.svg'
import ArrowDown from '../svgs/arrow-down-s-fill.svg'

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
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [item])

  return (
    <Modal
      show={!!item}
      onHide={() => {
        setItem(null)
        setOpen(false)
      }}
    >
      <Modal.Body>
        <Form
          initial={{
            amount: 21
          }}
          schema={ActSchema}
          onSubmit={async ({ amount, submit }) => {
            await item.act({ variables: { id: item.itemId, act: submit, sats: Number(amount) } })
            await item.strike()
            setOpen(false)
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
          <div className='d-flex justify-content-between'>
            <SubmitButton variant='boost' className='mt-1' value='BOOST'>boost</SubmitButton>
            <SubmitButton variant='success' className='mt-1 px-4' value='TIP'>tip</SubmitButton>
          </div>
          <Accordion className='pt-3'>
            <Accordion.Toggle
              as={props => <div {...props} />}
              eventKey='0'
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              onClick={() => setOpen(!open)}
            >
              {open
                ? <ArrowDown className='fill-grey' height={16} width={16} />
                : <ArrowRight className='fill-grey' height={16} width={16} />}
              <small className='text-muted text-underline'>I'm confused</small>
            </Accordion.Toggle>
            <Accordion.Collapse eventKey='0' className='mt-2'>
              <span>Tips go directly to the poster or commenter. Boosts boost the rank
                of the post or comment for a limited time, and the sats go to the site.
              </span>
            </Accordion.Collapse>
          </Accordion>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
