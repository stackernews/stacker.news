import React from 'react'
import Button from 'react-bootstrap/Button'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import { useMutation, gql } from '@apollo/client'
import { useMe } from './me'
import { numWithUnits } from '../lib/format'
import { useShowModal } from './modal'
import { useRoot } from './root'
import { payOrLoginError, useInvoiceModal } from './invoice'

export default function PayBounty ({ children, item }) {
  const me = useMe()
  const showModal = useShowModal()
  const root = useRoot()

  const [act] = useMutation(
    gql`
      mutation act($id: ID!, $sats: Int!, $hash: String, $hmac: String) {
        act(id: $id, sats: $sats, hash: $hash, hmac: $hmac) {
          sats
        }
      }`, {
      update (cache, { data: { act: { sats } } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            sats (existingSats = 0) {
              return existingSats + sats
            },
            meSats (existingSats = 0) {
              return existingSats + sats
            }
          }
        })

        // update all ancestor comment sats
        item.path.split('.').forEach(id => {
          if (Number(id) === Number(item.id)) return
          cache.modify({
            id: `Item:${id}`,
            fields: {
              commentSats (existingCommentSats = 0) {
                return existingCommentSats + sats
              }
            }
          })
        })

        // update root bounty status
        cache.modify({
          id: `Item:${root.id}`,
          fields: {
            bountyPaidTo (existingPaidTo = []) {
              return [...(existingPaidTo || []), Number(item.id)]
            }
          }
        })
      }
    }
  )
  const showInvoiceModal = useInvoiceModal(async ({ hash, hmac }, { variables }) => {
    await act({ variables: { ...variables, hash, hmac } })
  }, [act])

  const handlePayBounty = async onComplete => {
    try {
      await act({
        variables: { id: item.id, sats: root.bounty },
        optimisticResponse: {
          act: {
            id: `Item:${item.id}`,
            sats: root.bounty
          }
        }
      })
      onComplete()
    } catch (error) {
      if (payOrLoginError(error)) {
        showInvoiceModal({ amount: root.bounty }, { variables: { id: item.id, sats: root.bounty } })
        return
      }
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
