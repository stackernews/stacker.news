import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useToast } from './toast'
import { useLightning } from './lightning'
import { nextTip } from './upvote'
import { InvoiceCanceledError, PaymentProvider, usePayment } from './payment'

const defaultTips = [100, 1000, 10_000, 100_000]

const Tips = ({ setOValue }) => {
  const tips = [...getCustomTips(), ...defaultTips].sort((a, b) => a - b)
  return tips.map((num, i) =>
    <Button
      size='sm'
      className={`${i > 0 ? 'ms-2' : ''} mb-2`}
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

export default function ItemAct ({ onClose, item, down, children }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()
  const strike = useLightning()
  const cache = useApolloClient().cache

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, item.id])

  const act = useAct()

  const onSubmit = useCallback(async ({ amount, hash, hmac }) => {
    if (!me) {
      const storageKey = `TIP-item:${item.id}`
      const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
      window.localStorage.setItem(storageKey, existingAmount + amount)
    }
    await act({
      variables: {
        id: item.id,
        sats: Number(amount),
        act: down ? 'DONT_LIKE_THIS' : 'TIP',
        hash,
        hmac
      }
    })
    addCustomTip(Number(amount))
  }, [me, act, down, item.id, strike, onClose])

  const beforePayment = useCallback(({ amount }) => {
    onClose()
    strike()
    return actUpdate(cache, { ...item, sats: Number(amount), act: down ? 'DONT_LIKE_THIS' : 'TIP' }, { me })
  }, [cache, strike, onClose])

  // we need to wrap with PaymentProvider here since modals don't have access to PaymentContext by default
  return (
    <PaymentProvider>
      <Form
        initial={{
          amount: me?.privates?.tipDefault || defaultTips[0],
          default: false
        }}
        schema={amountSchema}
        invoiceable
        onSubmit={onSubmit}
        beforePayment={beforePayment}
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
        <div className='d-flex mt-3'>
          <SubmitButton variant={down ? 'danger' : 'success'} className='ms-auto mt-1 px-4' value='TIP'>{down && 'down'}zap</SubmitButton>
        </div>
      </Form>
    </PaymentProvider>
  )
}

export const actUpdate = (cache, { id, sats, path, act }, { me }) => {
  const updateItemSats = (id, sats) => {
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
    }
  }

  updateItemSats(id, sats)
  return () => {
    updateItemSats(id, -sats)
  }
}

export function useAct ({ onUpdate } = {}) {
  const [act] = useMutation(
    gql`
      mutation act($id: ID!, $sats: Int!, $act: String, $hash: String, $hmac: String) {
        act(id: $id, sats: $sats, act: $act, hash: $hash, hmac: $hmac) {
          id
          sats
          path
          act
        }
      }`
  )
  return act
}

const zapUpdate = (cache, args) => {
  const { data: { act: { id, sats, path } } } = args

  const readItemFragment = id => cache.readFragment({
    id: `Item:${id}`,
    fragment: gql`
        fragment ItemMeSatsZap on Item {
          meSats
        }
      `
  })

  const updateItemSats = (id, satsDelta, meSats) => cache.modify({
    id: `Item:${id}`,
    fields: {
      sats (existingSats = 0) {
        return existingSats + satsDelta
      },
      meSats: () => {
        return meSats
      }
    }
  })

  const updateItemCommentSats = (id, satsDelta) => cache.modify({
    id: `Item:${id}`,
    fields: {
      commentSats (existingCommentSats = 0) {
        return existingCommentSats + satsDelta
      }
    }
  })

  // determine how much we increased existing sats by by checking the
  // difference between result sats and meSats
  // if it's negative, skip the cache as it's an out of order update
  // if it's positive, add it to sats and commentSats

  const item = readItemFragment(id)

  const satsDelta = sats - item.meSats

  if (satsDelta > 0) {
    updateItemSats(id, satsDelta, sats)
    // update all ancestors
    path.split('.').forEach(aId => {
      if (Number(aId) === Number(id)) return
      updateItemCommentSats(aId, satsDelta)
    })
  }

  return () => {
    if (satsDelta > 0) {
      updateItemSats(id, -satsDelta, item.meSats)
      path.split('.').forEach(aId => {
        if (Number(aId) === Number(id)) return
        updateItemCommentSats(aId, -satsDelta)
      })
    }
  }
}

export function useZap () {
  const client = useApolloClient()

  const [zap] = useMutation(
    gql`
      mutation idempotentAct($id: ID!, $sats: Int!, $hash: String, $hmac: String) {
        act(id: $id, sats: $sats, hash: $hash, hmac: $hmac, idempotent: true) {
          id
          sats
          path
        }
      }`
  )

  const toaster = useToast()
  const strike = useLightning()
  const payment = usePayment()

  return useCallback(async ({ item, me }) => {
    const meSats = (item?.meSats || 0)

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = meSats + nextTip(meSats, { ...me?.privates })

    let hash, hmac, cancel, revert
    try {
      const optimisticResponse = { act: { path: item.path, id: item.id, sats, act: 'TIP' } }
      revert = zapUpdate(client.cache, { data: optimisticResponse })
      strike();
      [{ hash, hmac }, cancel] = await payment.request(sats - meSats)
      const variables = { ...optimisticResponse.act, hash, hmac }
      await zap({ variables })
    } catch (error) {
      revert?.()
      if (error instanceof InvoiceCanceledError) {
        return
      }
      console.error(error)
      toaster.danger('zap failed: ' + error?.message || error?.toString?.())
      cancel?.()
    }
  }, [strike, payment])
}
