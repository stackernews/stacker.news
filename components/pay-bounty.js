import React, { useCallback } from 'react'
import Button from 'react-bootstrap/Button'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import { numWithUnits } from '@/lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { actUpdate, useAct } from './item-act'
import { InvoiceCanceledError, usePayment } from './payment'
import { useApolloClient } from '@apollo/client'

export default function PayBounty ({ children, item }) {
  const me = useMe()
  const showModal = useShowModal()
  const root = useRoot()
  const payment = usePayment()
  const cache = useApolloClient().cache

  const updateBountyPaidTo = useCallback(() => {
    // update root bounty status
    const root = item.path.split('.')[0]
    cache.modify({
      id: `Item:${root}`,
      fields: {
        bountyPaidTo (existingPaidTo = []) {
          return [...(existingPaidTo || []), Number(item.id)]
        }
      }
    })
    return () => {
      cache.modify({
        id: `Item:${root}`,
        fields: {
          bountyPaidTo (existingPaidTo = []) {
            return existingPaidTo.filter(id => id !== Number(item.id))
          }
        }
      })
    }
  }, [cache, item])

  const act = useAct()

  const handlePayBounty = async onComplete => {
    let cancel; const revert = []
    try {
      let hash, hmac
      const sats = root.bounty
      const variables = { id: item.id, sats, path: item.path, act: 'TIP' }
      revert.push(actUpdate(cache, variables))
      revert.push(updateBountyPaidTo());
      [{ hash, hmac }, cancel] = await payment.request(sats)
      await act({
        variables: { ...variables, hash, hmac },
        optimisticResponse: {
          act: variables
        }
      })
      onComplete()
    } catch (error) {
      revert.forEach(r => r())
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
