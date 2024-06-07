import React, { useCallback } from 'react'
import Button from 'react-bootstrap/Button'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { useAct } from './item-act'
import { InvoiceCanceledError } from './payment'
import { useLightning } from './lightning'
import { useToast } from './toast'

export default function PayBounty ({ children, item }) {
  const me = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const strike = useLightning()
  const toaster = useToast()

  const onUpdate = useCallback(onComplete => (cache, { data: { act: { result } } }) => {
    if (!result) return
    const { id, path } = result

    // update root bounty status
    const root = path.split('.')[0]
    cache.modify({
      id: `Item:${root}`,
      fields: {
        bountyPaidTo (existingPaidTo = []) {
          return [...(existingPaidTo || []), Number(id)]
        }
      }
    })
    onComplete()
  }, [])

  const handlePayBounty = async onComplete => {
    const sats = root.bounty
    const variables = { id: item.id, sats, act: 'TIP', path: item.path }
    const optimisticResponse = { act: { result: { ...variables, path: item.path } } }
    const act = useAct({ update: onUpdate(onComplete) })
    try {
      strike()
      await act({
        variables,
        optimisticResponse
      })
    } catch (error) {
      if (error instanceof InvoiceCanceledError) {
        return
      }

      const reason = error?.message || error?.toString?.()

      toaster.danger('pay bounty failed: ' + reason)
    }
  }

  if (!me || item.mine || root.user.name !== me.name) {
    return null
  }

  return (
    <ActionTooltip
      notForm
      overlayText={numWithUnits(root.bounty)}
    >
      <div
        className={styles.pay} onClick={() => {
          showModal(onClose => (
            <>
              <div className='text-center fw-bold text-muted'>
                Pay this bounty to {item.user.name}?
              </div>
              <div className='text-center'>
                <Button className='mt-4' variant='primary' onClick={() => handlePayBounty(onClose)}>
                  pay <small>{numWithUnits(root.bounty)}</small>
                </Button>
              </div>
            </>
          ))
        }}
      >
        pay bounty
      </div>
    </ActionTooltip>
  )
}
