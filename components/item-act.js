import { Button, InputGroup } from 'react-bootstrap'
import React, { useState, useRef, useEffect } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '../svgs/bolt.svg'
import { amountSchema } from '../lib/validate'

const defaultTips = [100, 1000, 10000, 100000]

const Tips = ({ setOValue }) => {
  const customTips = getCustomTips().sort((a, b) => a - b)
  return [...customTips, ...defaultTips].map(num =>
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
    </Button>)
}

const getCustomTips = () => JSON.parse(localStorage.getItem('custom-tips')) || []

const addCustomTip = (amount) => {
  if (defaultTips.includes(amount)) return
  let customTips = Array.from(new Set([amount, ...getCustomTips()]))
  if (customTips.length > 3) {
    customTips = customTips.slice(0, 3)
  }
  localStorage.setItem('custom-tips', JSON.stringify(customTips))
}

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
        addCustomTip(Number(amount))
        onClose()
      }}
    >
      <Input
        label='amount'
        name='amount'
        type='number'
        innerRef={inputRef}
        overrideValue={oValue}
        required
        autoFocus
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      <div>
        <Tips setOValue={setOValue} />
      </div>
      <div className='d-flex'>
        <SubmitButton variant='success' className='ml-auto mt-1 px-4' value='TIP'>tip</SubmitButton>
      </div>
    </Form>
  )
}
