import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '../svgs/bolt.svg'
import { amountSchema } from '../lib/validate'
import { gql, useMutation } from '@apollo/client'

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

export default function ItemAct ({ onClose, itemId, down, strike, children }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, itemId])

  const [act] = useAct()

  const onSubmit = useCallback(async ({ amount, hash, hmac }) => {
    if (!me) {
      const storageKey = `TIP-item:${itemId}`
      const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
      window.localStorage.setItem(storageKey, existingAmount + amount)
    }
    await act({
      variables: {
        id: itemId,
        sats: Number(amount),
        act: down ? 'DONT_LIKE_THIS' : 'TIP',
        hash,
        hmac
      }
    })
    strike && await strike()
    addCustomTip(Number(amount))
    onClose()
  }, [act, down, itemId, strike])

  return (
    <Form
      initial={{
        amount: me?.privates?.tipDefault || defaultTips[0],
        default: false
      }}
      schema={amountSchema}
      invoiceable
      onSubmit={onSubmit}
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
      {children}
      <div className='d-flex'>
        <SubmitButton variant={down ? 'danger' : 'success'} className='ms-auto mt-1 px-4' value='TIP'>{down && 'down'}zap</SubmitButton>
      </div>
    </Form>
  )
}

export function useAct ({ onUpdate } = {}) {
  const me = useMe()

  const update = useCallback((cache, args) => {
    const { data: { act: { id, sats, path, act } } } = args

    cache.modify({
      id: `Item:${id}`,
      fields: {
        sats (existingSats = 0) {
          if (act === 'TIP') {
            return existingSats + sats
          }

          return existingSats
        },
        meSats: me
          ? (existingSats = 0) => {
              if (act === 'TIP') {
                return existingSats + sats
              }

              return existingSats
            }
          : undefined,
        meDontLikeSats: me
          ? (existingSats = 0) => {
              if (act === 'DONT_LIKE_THIS') {
                return existingSats + sats
              }

              return existingSats
            }
          : undefined
      }
    })

    if (act === 'TIP') {
      // update all ancestors
      path.split('.').forEach(aId => {
        if (Number(aId) === Number(id)) return
        cache.modify({
          id: `Item:${aId}`,
          fields: {
            commentSats (existingCommentSats = 0) {
              return existingCommentSats + sats
            }
          }
        })
      })

      onUpdate && onUpdate(cache, args)
    }
  }, [!!me, onUpdate])

  return useMutation(
    gql`
      mutation act($id: ID!, $sats: Int!, $act: String, $hash: String, $hmac: String) {
        act(id: $id, sats: $sats, act: $act, hash: $hash, hmac: $hmac) {
          id
          sats
          path
          act
        }
      }`, { update }
  )
}
