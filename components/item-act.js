import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '../svgs/bolt.svg'
import { amountSchema } from '../lib/validate'
import { gql, useMutation } from '@apollo/client'
import { payOrLoginError, useInvoiceModal } from './invoice'
import { useToast } from './toast'
import { useLightning } from './lightning'

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

export default function ItemAct ({ onClose, itemId, down, children }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()
  const strike = useLightning()

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
    await strike()
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

export function useZap () {
  const update = useCallback((cache, args) => {
    const { data: { act: { id, sats, path } } } = args

    // determine how much we increased existing sats by by checking the
    // difference between result sats and meSats
    // if it's negative, skip the cache as it's an out of order update
    // if it's positive, add it to sats and commentSats

    const item = cache.readFragment({
      id: `Item:${id}`,
      fragment: gql`
        fragment ItemMeSats on Item {
          meSats
        }
      `
    })

    const satsDelta = sats - item.meSats

    if (satsDelta > 0) {
      cache.modify({
        id: `Item:${id}`,
        fields: {
          sats (existingSats = 0) {
            return existingSats + satsDelta
          },
          meSats: () => {
            return sats
          }
        }
      })

      // update all ancestors
      path.split('.').forEach(aId => {
        if (Number(aId) === Number(id)) return
        cache.modify({
          id: `Item:${aId}`,
          fields: {
            commentSats (existingCommentSats = 0) {
              return existingCommentSats + satsDelta
            }
          }
        })
      })
    }
  }, [])

  const [zap] = useMutation(
    gql`
      mutation idempotentAct($id: ID!, $sats: Int!) {
        act(id: $id, sats: $sats, idempotent: true) {
          id
          sats
          path
        }
      }`, { update }
  )

  const toaster = useToast()
  const strike = useLightning()
  const [act] = useAct()

  const showInvoiceModal = useInvoiceModal(
    async ({ hash, hmac }, { variables }) => {
      await act({ variables: { ...variables, hash, hmac } })
      strike()
    }, [act, strike])

  return useCallback(async ({ item, me }) => {
    const meSats = (item?.meSats || 0)

    // what should our next tip be?
    let sats = me?.privates?.tipDefault || 1
    if (me?.privates?.turboTipping) {
      while (meSats >= sats) {
        sats *= 10
      }
    } else {
      sats = meSats + sats
    }

    const variables = { id: item.id, sats, act: 'TIP' }
    try {
      await zap({
        variables,
        optimisticResponse: {
          act: {
            path: item.path,
            ...variables
          }
        }
      })
    } catch (error) {
      if (payOrLoginError(error)) {
        // call non-idempotent version
        const amount = sats - meSats
        try {
          await showInvoiceModal({ amount }, { variables: { ...variables, sats: amount } })
        } catch (error) {}
        return
      }
      console.error(error)
      toaster.danger(error?.message || error?.toString?.())
    }
  })
}
