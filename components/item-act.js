import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { gql, useMutation } from '@apollo/client'
import { useToast } from './toast'
import { useLightning } from './lightning'
import { nextTip } from './upvote'
import { InvoiceCanceledError, usePayment } from './payment'
import { Types as ClientNotification, ClientNotifyProvider, useClientNotifications } from './client-notifications'
import { ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { useItemContext } from './item'

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

const setItemMeAnonSats = ({ id, amount }) => {
  const storageKey = `TIP-item:${id}`
  const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
  window.localStorage.setItem(storageKey, existingAmount + amount)
}

export const actUpdate = ({ me, onUpdate }) => (cache, args) => {
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
      meSats: (existingSats = 0) => {
        if (act === 'TIP') {
          return existingSats + sats
        }

        return existingSats
      },
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

  onUpdate?.(cache, args)
}

export default function ItemAct ({ onClose, item, down, children, abortSignal, optimisticUpdate }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, item.id])

  const act = useAct()

  const onSubmit = useCallback(async ({ amount, hash, hmac }) => {
    await act({
      variables: {
        id: item.id,
        sats: Number(amount),
        act: down ? 'DONT_LIKE_THIS' : 'TIP',
        hash,
        hmac
      },
      update: actUpdate({ me })
    })
    if (!me) setItemMeAnonSats({ id: item.id, amount })
    addCustomTip(Number(amount))
  }, [me, act, down, item.id])

  return (
    <ClientNotifyProvider additionalProps={{ itemId: item.id }}>
      <Form
        initial={{
          amount: me?.privates?.tipDefault || defaultTips[0],
          default: false
        }}
        schema={amountSchema}
        prepaid
        optimisticUpdate={({ amount }) => optimisticUpdate(amount, { onClose })}
        onSubmit={onSubmit}
        clientNotification={ClientNotification.Zap}
        signal={abortSignal}
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
    </ClientNotifyProvider>
  )
}

export const ACT_MUTATION = gql`
  mutation act($id: ID!, $sats: Int!, $act: String, $hash: String, $hmac: String) {
    act(id: $id, sats: $sats, act: $act, hash: $hash, hmac: $hmac) {
      id
      sats
      path
      act
    }
  }`

export function useAct ({ onUpdate } = {}) {
  const [act] = useMutation(ACT_MUTATION)
  return act
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
        fragment ItemMeSatsZap on Item {
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

  const ZAP_MUTATION = gql`
    mutation idempotentAct($id: ID!, $sats: Int!, $hash: String, $hmac: String) {
      act(id: $id, sats: $sats, hash: $hash, hmac: $hmac, idempotent: true) {
        id
        sats
        path
      }
    }`
  const [zap] = useMutation(ZAP_MUTATION)
  const me = useMe()
  const { notify, unnotify } = useClientNotifications()

  const toaster = useToast()
  const strike = useLightning()
  const payment = usePayment()
  const { pendingSats } = useItemContext()

  return useCallback(async ({ item, abortSignal, optimisticUpdate }) => {
    const meSats = (item?.meSats || 0) + pendingSats

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = meSats + nextTip(meSats, { ...me?.privates })
    const satsDelta = sats - meSats

    const variables = { id: item.id, sats, act: 'TIP' }
    const notifyProps = { itemId: item.id, sats: satsDelta }
    // const optimisticResponse = { act: { path: item.path, ...variables } }

    let revert, cancel, nid
    try {
      revert = optimisticUpdate?.(satsDelta)

      await abortSignal.pause({ me, amount: satsDelta })

      if (me) {
        nid = notify(ClientNotification.Zap.PENDING, notifyProps)
      }

      let hash, hmac;
      [{ hash, hmac }, cancel] = await payment.request(satsDelta)

      await zap({
        variables: { ...variables, hash, hmac },
        update: (...args) => {
          revert?.()
          update(...args)
        }
      })
    } catch (error) {
      revert?.()
      if (error instanceof InvoiceCanceledError || error instanceof ActCanceledError) {
        return
      }

      const reason = error?.message || error?.toString?.()
      if (me) {
        notify(ClientNotification.Zap.ERROR, { ...notifyProps, reason })
      } else {
        toaster.danger('zap failed: ' + reason)
      }

      cancel?.()
    } finally {
      if (nid) unnotify(nid)
    }
  }, [me?.id, strike, payment, notify, unnotify, pendingSats])
}

export class ActCanceledError extends Error {
  constructor () {
    super('act canceled')
    this.name = 'ActCanceledError'
  }
}

export class ZapUndoController extends AbortController {
  constructor () {
    super()
    this.signal.start = () => { this.started = true }
    this.signal.done = () => { this.done = true }
    this.signal.pause = async ({ me, amount }) => {
      if (zapUndoTrigger({ me, amount })) {
        await zapUndo(this.signal)
      }
    }
  }
}

const zapUndoTrigger = ({ me, amount }) => {
  if (!me) return false
  const enabled = me.privates.zapUndos !== null
  return enabled ? amount >= me.privates.zapUndos : false
}

const zapUndo = async (signal) => {
  return await new Promise((resolve, reject) => {
    signal.start()
    const abortHandler = () => {
      reject(new ActCanceledError())
      signal.done()
      signal.removeEventListener('abort', abortHandler)
    }
    signal.addEventListener('abort', abortHandler)
    setTimeout(() => {
      resolve()
      signal.done()
      signal.removeEventListener('abort', abortHandler)
    }, ZAP_UNDO_DELAY_MS)
  })
}
