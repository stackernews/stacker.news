import React, { useCallback } from 'react'
import Button from 'react-bootstrap/Button'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { useAct } from './item-act'
import { InvoiceCanceledError, usePayment } from './payment'

export default function PayBounty ({ children, item }) {
  const me = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const payment = usePayment()

  const onUpdate = useCallback((cache, { data: { act: { id, path } } }) => {
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
  }, [])

  // FIXME: call onUpdate during optimistic update of act
  const act = useAct({ onUpdate })

  const handlePayBounty = async onComplete => {
    let hash, hmac, cancel
    try {
      const sats = root.bounty;
      [{ hash, hmac }, cancel] = await payment.request(sats)
      const variables = { id: item.id, sats, act: 'TIP', path: item.path, hash, hmac }
      await act({
        variables,
        optimisticResponse: {
          act: variables
        }
      })
      onComplete()
    } catch (error) {
      if (error instanceof InvoiceCanceledError) {
        return
      }
      cancel?.()
      throw new Error({ message: error.toString() })
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
