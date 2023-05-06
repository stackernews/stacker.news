import { Button, InputGroup } from 'react-bootstrap'
import React, { useState, useRef, useEffect } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '../svgs/bolt.svg'
import { amountSchema } from '../lib/validate'

export default function ItemAct ({ onClose, itemId, act, strike }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, itemId])

  return (
    <Form
      initial={{
        amount: me?.tipDefault,
        default: false
      }}
      schema={amountSchema}
      onSubmit={async ({ amount }) => {
        await act({
          variables: {
            id: itemId,
            sats: Number(amount)
          }
        })
        await strike()
        onClose()
      }}
    >
      <Input
        label='amount'
        name='amount'
        innerRef={inputRef}
        overrideValue={oValue}
        required
        autoFocus
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      <div>
        {[100, 1000, 10000, 100000].map(num =>
          <Button
            size='sm'
            className={`${num > 1 ? 'ml-2' : ''} mb-2`}
            key={num}
            onClick={() => { setOValue(num) }}
          >
            <UpBolt
              className='mr-1'
              width={14}
              height={14}
            />{num}
          </Button>)}
      </div>
      <div className='d-flex'>
        <SubmitButton variant='success' className='ml-auto mt-1 px-4' value='TIP'>tip</SubmitButton>
      </div>
    </Form>
  )
}
