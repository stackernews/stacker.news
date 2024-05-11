import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useLightning } from './lightning'
import { nextTip } from './upvote'
import { InvoiceCanceledError, usePayment } from './payment'
import { ZAP_UNDO_DELAY } from '@/lib/constants'
import { NotificationType, useNotifications } from './notifications'
import { useToast } from './toast'

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

export default function ItemAct ({ onClose, item, down, children, abortSignal }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()
  const strike = useLightning()
  const cache = useApolloClient().cache
  const { notify, unnotify } = useNotifications()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, item.id])

  const act = useAct()

  const onSubmit = useCallback(async ({ amount, hash, hmac }) => {
    try {
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
      if (me) persistItemPendingSats({ ...item, act: down ? 'DONT_LIKE_THIS' : 'TIP', sats: -amount })
    } finally {
      abortSignal?.done()
    }
  }, [me, act, down, item.id, strike, onClose, abortSignal])

  const optimisticUpdate = useCallback(async ({ amount }) => {
    onClose()
    strike()
    const revert = actOptimisticUpdate(cache, { ...item, sats: Number(amount), act: down ? 'DONT_LIKE_THIS' : 'TIP' }, { me })
    abortSignal?.start()
    if (zapUndoTrigger(me, amount)) {
      try {
        await zapUndo(abortSignal)
      } catch (err) {
        revert()
        throw err
      }
    } else {
      abortSignal?.done()
    }
    return revert
  }, [cache, strike, onClose, abortSignal])

  return (
    <Form
      initial={{
        amount: me?.privates?.tipDefault || defaultTips[0],
        default: false
      }}
      schema={amountSchema}
      invoiceable
      onSubmit={onSubmit}
      optimisticUpdate={optimisticUpdate}
      onError={me
        ? ({ reason, amount }) => {
            notify(NotificationType.ZapError, { reason, amount, itemId: item.id })
          }
        : undefined}
      beforeSubmit={({ amount }) => {
        const nid = notify(NotificationType.ZapPending, { amount, itemId: item.id }, false)
        return { nid }
      }}
      afterSubmit={({ amount, nid }) => {
        unnotify(nid)
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
      {children}
      <div className='d-flex mt-3'>
        <SubmitButton variant={down ? 'danger' : 'success'} className='ms-auto mt-1 px-4' value='TIP'>{down && 'down'}zap</SubmitButton>
      </div>
    </Form>
  )
}

const updateItemSats = (cache, { id, path, act, sats }, { me }) => {
  if (sats < 0) {
    // if sats < 0, we are reverting.
    // in that case, it is important that we first revert the persisted sats
    // before calling cache.modify since cache.modify will trigger field reads
    // and thus persisted sats will be counted
    if (!me) persistItemAnonSats({ id, path, act, sats })
    else persistItemPendingSats({ id, path, act, sats })
  }

  cache.modify({
    id: `Item:${id}`,
    fields: {
      sats (existingSats = 0) {
        return act === 'TIP' ? existingSats + sats : existingSats
      },
      meSats (existingSats = 0) {
        return act === 'TIP' ? existingSats + sats : existingSats
      },
      meDontLikeSats: me
        ? (existingSats = 0) => {
            return act === 'DONT_LIKE_THIS' ? existingSats + sats : existingSats
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

  if (sats > 0) {
    if (!me) persistItemAnonSats({ id, path, act, sats })
    else persistItemPendingSats({ id, path, act, sats })
  }
}

const persistItemAnonSats = ({ id, path, act, sats }) => {
  const storageKey = `TIP-item:ANON:${act}:${id}`
  const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
  window.localStorage.setItem(storageKey, existingAmount + sats)
  // we don't save TIP-comment for anons because we only need TIP-comment for
  // persistence of pending item.commentSats but anon sats are never pending
  // since anons have to pay immediately or optimistic update is reverted.
  // XXX this changes when anons can have attached wallets
}

const persistItemPendingSats = ({ id, path, act, sats }) => {
  const storageKey = `TIP-item:PENDING:${act}:${id}`
  const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
  window.localStorage.setItem(storageKey, existingAmount + sats)
  if (act === 'TIP') {
    path.split('.').forEach(aId => {
      if (Number(aId) === Number(id)) return
      const storageKey = `TIP-comment:PENDING:${act}:${aId}`
      const existingAmount = Number(window.localStorage.getItem(storageKey) || '0')
      window.localStorage.setItem(storageKey, existingAmount + sats)
    })
  }
}

export const actOptimisticUpdate = (cache, { id, sats, path, act }, { me }) => {
  updateItemSats(cache, { id, path, act, sats }, { me })
  return () => updateItemSats(cache, { id, path, act, sats: -sats }, { me })
}

export function useAct () {
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

const zapOptimisticUpdate = (cache, { id, path, act, sats }, { me }) => {
  const readItemFragment = id => cache.readFragment({
    id: `Item:${id}`,
    fragment: gql`
        fragment ItemMeSatsZap on Item {
          meSats
        }
      `
  })

  // determine how much we increased existing sats
  // by checking the difference between result sats and meSats
  // if it's negative, skip the cache as it's an out of order update
  // if it's positive, add it to sats and commentSats
  const item = readItemFragment(id)
  const satsDelta = sats - item.meSats

  if (satsDelta > 0) {
    updateItemSats(cache, { id, path, act, sats: satsDelta }, { me })
  }

  return () => {
    if (satsDelta > 0) {
      updateItemSats(cache, { id, path, act, sats: -satsDelta }, { me })
    }
  }
}

export function useZap () {
  const cache = useApolloClient().cache

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

  const me = useMe()
  const strike = useLightning()
  const payment = usePayment()
  const { notify, unnotify } = useNotifications()
  const toaster = useToast()

  return useCallback(async ({ item, me }, { abortSignal }) => {
    const meSats = (item?.meSats || 0)

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = meSats + nextTip(meSats, { ...me?.privates })

    const act = 'TIP'
    let cancel, revert, nid
    try {
      const variables = { path: item.path, id: item.id, sats, act }
      revert = zapOptimisticUpdate(cache, variables, { me })
      strike()
      abortSignal?.start()
      nid = notify(NotificationType.ZapPending, { amount: sats - meSats, itemId: item.id }, false)
      if (zapUndoTrigger(me, sats)) {
        await zapUndo(abortSignal)
      } else {
        abortSignal?.done()
      }
      let hash, hmac;
      [{ hash, hmac }, cancel] = await payment.request(sats - meSats)
      await zap({ variables: { ...variables, hash, hmac } })
      if (me) persistItemPendingSats({ ...item, act, sats: -(sats - meSats) })
    } catch (error) {
      revert?.()
      if (error instanceof InvoiceCanceledError || error instanceof ActCanceledError) {
        return
      }
      const reason = error?.message || error?.toString?.()
      if (me) notify(NotificationType.ZapError, { reason, amount: sats - meSats, itemId: item.id })
      else toaster.danger('zap error: ' + reason)
      cancel?.()
    } finally {
      abortSignal?.done()
      unnotify(nid)
    }
  }, [me, strike, payment])
}

export class ActCanceledError extends Error {
  constructor () {
    super('act canceled')
    this.name = 'ActCanceledError'
  }
}

const zapUndoTrigger = (me, amount) => {
  if (!me) return false
  const enabled = me.privates.zapUndos !== null
  return enabled ? amount >= me.privates.zapUndos : false
}

const zapUndo = async (signal) => {
  return await new Promise((resolve, reject) => {
    const abortHandler = () => {
      reject(new ActCanceledError())
      signal.removeEventListener('abort', abortHandler)
    }
    signal.addEventListener('abort', abortHandler)
    setTimeout(() => {
      resolve()
      signal.removeEventListener('abort', abortHandler)
    }, ZAP_UNDO_DELAY)
  })
}
