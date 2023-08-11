import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '../svgs/bolt.svg'
import { amountSchema } from '../lib/validate'
import { useInvoiceable } from './invoice'

const defaultTips = [100, 1000, 10000, 100000]

const Tips = ({ setOValue }) => {
  const tips = [...getCustomTips(), ...defaultTips].sort((a, b) => a - b)
  return tips.map(num =>
    <Button
      size='sm'
      className={`${num > 1 ? 'ms-2' : ''} mb-2`}
      key={num}
      onClick={() => { setOValue(num) }}
    >
      <UpBolt
        className='me-1'
        width={14}
        height={14}
      />{num}
    </Button>)
}

const getCustomTips = () => JSON.parse(window.localStorage.getItem('custom-tips')) || []

const addCustomTip = (amount) => {
  if (defaultTips.includes(amount)) return
  let customTips = Array.from(new Set([amount, ...getCustomTips()]))
  if (customTips.length > 3) {
    customTips = customTips.slice(0, 3)
  }
  window.localStorage.setItem('custom-tips', JSON.stringify(customTips))
}

export default function ItemAct ({ onClose, itemId, act, strike }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, itemId])

  const submitAct = useCallback(
    async (amount, invoiceHash, invoiceHmac) => {
      if (!me) {
        const storageKey = `TIP-item:${itemId}`
        const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
        window.localStorage.setItem(storageKey, existingAmount + amount)
      }
      await act({
        variables: {
          id: itemId,
          sats: Number(amount),
          invoiceHash,
          invoiceHmac
        }
      })
      await strike()
      addCustomTip(Number(amount))
      onClose()
    }, [act, onClose, strike, itemId])

  const invoiceableAct = useInvoiceable(submitAct)

  return (
    <Form
      initial={{
        amount: me?.tipDefault,
        default: false
      }}
      schema={amountSchema}
      onSubmit={async ({ amount }) => {
        return invoiceableAct(amount)
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
        <SubmitButton variant='success' className='ms-auto mt-1 px-4' value='TIP'>zap</SubmitButton>
      </div>
    </Form>
  )
}
