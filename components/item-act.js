import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { payOrLoginError, useInvoiceModal } from './invoice'
import { TOAST_DEFAULT_DELAY_MS, useToast, withToastFlow } from './toast'
import { useLightning } from './lightning'
import { nextTip } from './upvote'

const defaultTips = [100, 1000, 10000, 100000]

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

export const zapUndosThresholdReached = (me, amount) => {
  if (!me) return false
  const enabled = me.privates.zapUndos !== null
  return enabled ? amount >= me.privates.zapUndos : false
}

export default function ItemAct ({ onClose, itemId, down, children }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()
  const strike = useLightning()
  const toaster = useToast()
  const client = useApolloClient()

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, itemId])

  const [act, actUpdate] = useAct()

  const onSubmit = useCallback(async ({ amount, hash, hmac }, { update, keepOpen }) => {
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
      },
      update
    })
    // only strike when zap undos not enabled
    // due to optimistic UX on zap undos
    if (!zapUndosThresholdReached(me, Number(amount))) await strike()
    addCustomTip(Number(amount))
    if (!keepOpen) onClose(Number(amount))
  }, [me, act, down, itemId, strike])

  const onSubmitWithUndos = withToastFlow(toaster)(
    (values, args) => {
      const { flowId } = args
      let canceled
      const sats = values.amount
      const insufficientFunds = me?.privates?.sats < sats
      const invoiceAttached = values.hash && values.hmac
      if (insufficientFunds && !invoiceAttached) throw new Error('insufficient funds')
      // payments from external wallets already have their own flow
      // and we don't want to show undo toasts for them
      const skipToastFlow = invoiceAttached
      // update function for optimistic UX
      const update = () => {
        const fragment = {
          id: `Item:${itemId}`,
          fragment: gql`
          fragment ItemMeSatsSubmit on Item {
            path
            sats
            meSats
            meDontLikeSats
          }
        `
        }
        const item = client.cache.readFragment(fragment)
        const optimisticResponse = {
          act: {
            id: itemId, sats, path: item.path, act: down ? 'DONT_LIKE_THIS' : 'TIP'
          }
        }
        actUpdate(client.cache, { data: optimisticResponse })
        return () => client.cache.writeFragment({ ...fragment, data: item })
      }
      let undoUpdate
      return {
        skipToastFlow,
        flowId,
        tag: itemId,
        type: 'zap',
        pendingMessage: `${down ? 'down' : ''}zapped ${sats} sats`,
        onPending: async () => {
          if (skipToastFlow) {
            return onSubmit(values, { flowId, ...args, update: null })
          }
          await strike()
          onClose(sats)
          return new Promise((resolve, reject) => {
            undoUpdate = update()
            setTimeout(() => {
              if (canceled) return resolve()
              onSubmit(values, { flowId, ...args, update: null, keepOpen: true })
                .then(resolve)
                .catch((err) => {
                  undoUpdate()
                  reject(err)
                })
            }, TOAST_DEFAULT_DELAY_MS)
          })
        },
        onUndo: () => {
          canceled = true
          undoUpdate?.()
        },
        hideSuccess: true,
        hideError: true,
        timeout: TOAST_DEFAULT_DELAY_MS
      }
    }
  )

  return (
    <Form
      initial={{
        amount: me?.privates?.tipDefault || defaultTips[0],
        default: false
      }}
      schema={amountSchema}
      invoiceable
      onSubmit={(values, ...args) => {
        if (zapUndosThresholdReached(me, values.amount)) {
          return onSubmitWithUndos(values, ...args)
        }
        return onSubmit(values, ...args)
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

  const [act] = useMutation(
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
  return [act, update]
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

  const [zap] = useMutation(
    gql`
      mutation idempotentAct($id: ID!, $sats: Int!) {
        act(id: $id, sats: $sats, idempotent: true) {
          id
          sats
          path
        }
      }`
  )

  const toaster = useToast()
  const strike = useLightning()
  const [act] = useAct()
  const client = useApolloClient()

  const invoiceableAct = useInvoiceModal(
    async ({ hash, hmac }, { variables, ...apolloArgs }) => {
      await act({ variables: { ...variables, hash, hmac }, ...apolloArgs })
      strike()
    }, [act, strike])

  const zapWithUndos = withToastFlow(toaster)(
    ({ variables, optimisticResponse, update, flowId }) => {
      const { id: itemId, amount } = variables
      let canceled
      // update function for optimistic UX
      const _update = () => {
        const fragment = {
          id: `Item:${itemId}`,
          fragment: gql`
          fragment ItemMeSatsUndos on Item {
            sats
            meSats
          }
        `
        }
        const item = client.cache.readFragment(fragment)
        update(client.cache, { data: optimisticResponse })
        // undo function
        return () => client.cache.writeFragment({ ...fragment, data: item })
      }
      let undoUpdate
      return {
        flowId,
        tag: itemId,
        type: 'zap',
        pendingMessage: `zapped ${amount} sats`,
        onPending: () =>
          new Promise((resolve, reject) => {
            undoUpdate = _update()
            setTimeout(
              () => {
                if (canceled) return resolve()
                zap({ variables, optimisticResponse, update: null }).then(resolve).catch((err) => {
                  undoUpdate()
                  reject(err)
                })
              },
              TOAST_DEFAULT_DELAY_MS
            )
          }),
        onUndo: () => {
          // we can't simply clear the timeout on cancel since
          // the onPending promise would never settle in that case
          canceled = true
          undoUpdate?.()
        },
        hideSuccess: true,
        hideError: true,
        timeout: TOAST_DEFAULT_DELAY_MS
      }
    }
  )

  return useCallback(async ({ item, me }) => {
    const meSats = (item?.meSats || 0)

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = meSats + nextTip(meSats, { ...me?.privates })
    const amount = sats - meSats

    const variables = { id: item.id, sats, act: 'TIP', amount }
    const insufficientFunds = me?.privates.sats < amount
    const optimisticResponse = { act: { path: item.path, ...variables } }
    const flowId = (+new Date()).toString(16)
    const zapArgs = { variables, optimisticResponse: insufficientFunds ? null : optimisticResponse, update, flowId }
    try {
      if (insufficientFunds) throw new Error('insufficient funds')
      strike()
      if (zapUndosThresholdReached(me, amount)) {
        await zapWithUndos(zapArgs)
      } else {
        await zap(zapArgs)
      }
    } catch (error) {
      if (payOrLoginError(error)) {
        // call non-idempotent version
        const amount = sats - meSats
        optimisticResponse.act.amount = amount
        try {
          await invoiceableAct({ amount }, {
            variables: { ...variables, sats: amount },
            optimisticResponse,
            update,
            flowId
          })
        } catch (error) {}
        return
      }
      console.error(error)
      toaster.danger('zap: ' + error?.message || error?.toString?.())
    }
  })
}
