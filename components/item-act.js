import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { useToast } from './toast'
import { useLightning } from './lightning'
import { nextTip } from './upvote'
import { InvoiceCanceledError } from './payment'
import { ZAP_UNDO_DELAY_MS } from '@/lib/constants'
import { usePaidMutation } from './use-paid-mutation'
import { ACT_MUTATION } from '@/fragments/paidAction'

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

export default function ItemAct ({ onClose, item, down, children, abortSignal }) {
  const inputRef = useRef(null)
  const me = useMe()
  const [oValue, setOValue] = useState()
  const strike = useLightning()

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
      optimisticResponse: {
        act: { id: item.id, sats: Number(amount), act: down ? 'DONT_LIKE_THIS' : 'TIP', path: item.path }
      }
    })
    if (!me) setItemMeAnonSats({ id: item.id, amount })
    addCustomTip(Number(amount))
    strike()
    onClose()
  }, [me, act, down, item.id, strike])

  return (
    <Form
      initial={{
        amount: me?.privates?.tipDefault || defaultTips[0],
        default: false
      }}
      schema={amountSchema}
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
      <div className='d-flex mt-3'>
        <SubmitButton variant={down ? 'danger' : 'success'} className='ms-auto mt-1 px-4' value='TIP'>{down && 'down'}zap</SubmitButton>
      </div>
    </Form>
  )
}

export function useAct () {
  const [act] = usePaidMutation(ACT_MUTATION, {
    update: (cache, { data: { act: { result } } }) => {
      if (!result) return

      const { id, sats, path, act } = result

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
          meDontLikeSats: (existingSats = 0) => {
            if (act === 'DONT_LIKE_THIS') {
              return existingSats + sats
            }

            return existingSats
          }
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
  })

  return act
}

export function useZap () {
  const act = useAct()
  const me = useMe()

  const toaster = useToast()
  const strike = useLightning()

  return useCallback(async ({ item, mem, abortSignal }) => {
    const meSats = (item?.meSats || 0)

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = nextTip(meSats, { ...me?.privates })

    const variables = { id: item.id, sats, act: 'TIP' }
    const optimisticResponse = { act: { result: { path: item.path, ...variables } } }

    try {
      strike()
      await act({ variables, optimisticResponse })
    } catch (error) {
      if (error instanceof InvoiceCanceledError || error instanceof ActCanceledError) {
        return
      }

      const reason = error?.message || error?.toString?.()

      toaster.danger('zap failed: ' + reason)
    }
  }, [me?.id, strike])
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
