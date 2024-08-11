import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from './form'
import { useMe } from './me'
import UpBolt from '@/svgs/bolt.svg'
import { amountSchema } from '@/lib/validate'
import { useToast } from './toast'
import { useLightning } from './lightning'
import { nextTip, defaultTipIncludingRandom } from './upvote'
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

  useEffect(() => {
    inputRef.current?.focus()
  }, [onClose, item.id])

  const act = useAct()
  const strike = useLightning()

  const onSubmit = useCallback(async ({ amount }) => {
    if (abortSignal && zapUndoTrigger({ me, amount })) {
      onClose?.()
      try {
        await abortSignal.pause({ me, amount })
      } catch (error) {
        if (error instanceof ActCanceledError) {
          return
        }
      }
    }
    const { error } = await act({
      variables: {
        id: item.id,
        sats: Number(amount),
        act: down ? 'DONT_LIKE_THIS' : 'TIP'
      },
      optimisticResponse: me
        ? {
            act: {
              __typename: 'ItemActPaidAction',
              result: {
                id: item.id, sats: Number(amount), act: down ? 'DONT_LIKE_THIS' : 'TIP', path: item.path
              }
            }
          }
        : undefined,
      // don't close modal immediately because we want the QR modal to stack
      onCompleted: () => {
        strike()
        onClose?.()
        if (!me) setItemMeAnonSats({ id: item.id, amount })
      }
    })
    if (error) throw error
    addCustomTip(Number(amount))
  }, [me, act, down, item.id, onClose, abortSignal, strike])

  return (
    <Form
      initial={{
        amount: defaultTipIncludingRandom(me?.privates) || defaultTips[0],
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

function modifyActCache (cache, { result, invoice }) {
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

export function useAct ({ query = ACT_MUTATION, ...options } = {}) {
  // because the mutation name we use varies,
  // we need to extract the result/invoice from the response
  const getPaidActionResult = data => Object.values(data)[0]

  const [act] = usePaidMutation(query, {
    ...options,
    update: (cache, { data }) => {
      const response = getPaidActionResult(data)
      if (!response) return
      modifyActCache(cache, response)
      options?.update?.(cache, { data })
    },
    onPayError: (e, cache, { data }) => {
      const response = getPaidActionResult(data)
      if (!response || !response.result) return
      const { result: { sats } } = response
      const negate = { ...response, result: { ...response.result, sats: -1 * sats } }
      modifyActCache(cache, negate)
      options?.onPayError?.(e, cache, { data })
    },
    onPaid: (cache, { data }) => {
      const response = getPaidActionResult(data)
      if (!response) return
      options?.onPaid?.(cache, { data })
    }
  })
  return act
}

export function useZap () {
  const act = useAct()
  const me = useMe()
  const strike = useLightning()
  const toaster = useToast()

  return useCallback(async ({ item, abortSignal }) => {
    const meSats = (item?.meSats || 0)

    // add current sats to next tip since idempotent zaps use desired total zap not difference
    const sats = nextTip(meSats, { ...me?.privates })

    const variables = { id: item.id, sats, act: 'TIP' }
    const optimisticResponse = { act: { __typename: 'ItemActPaidAction', result: { path: item.path, ...variables } } }

    try {
      await abortSignal.pause({ me, amount: sats })
      strike()
      const { error } = await act({ variables, optimisticResponse })
      if (error) throw error
    } catch (error) {
      if (error instanceof ActCanceledError) {
        return
      }

      const reason = error?.message || error?.toString?.()
      toaster.danger(reason)
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
  constructor ({ onStart = () => {}, onDone = () => {} }) {
    super()
    this.signal.start = onStart
    this.signal.done = onDone
    this.signal.pause = async ({ me, amount }) => {
      if (zapUndoTrigger({ me, amount })) {
        await zapUndo(this.signal, amount)
      }
    }
  }
}

const zapUndoTrigger = ({ me, amount }) => {
  if (!me) return false
  const enabled = me.privates.zapUndos !== null
  return enabled ? amount >= me.privates.zapUndos : false
}

const zapUndo = async (signal, amount) => {
  return await new Promise((resolve, reject) => {
    signal.start(amount)
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
