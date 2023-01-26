import React from 'react'
import { Button } from 'react-bootstrap'
import styles from './pay-bounty.module.css'
import ActionTooltip from './action-tooltip'
import ModalButton from './modal-button'
import { useMutation, gql } from '@apollo/client'
import { useMe } from './me'
import { abbrNum } from '../lib/format'
import { useShowModal } from './modal'
import FundError from './fund-error'

export default function PayBounty ({ children, item }) {
  const me = useMe()
  const showModal = useShowModal()

  const [act] = useMutation(
    gql`
      mutation act($id: ID!, $sats: Int!) {
        act(id: $id, sats: $sats) {
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
          id: `Item:${item.root.id}`,
          fields: {
            bountyPaidTo (existingPaidTo = []) {
              return [...(existingPaidTo || []), Number(item.id)]
            }
          }
        })
      }
    }
  )

  const handlePayBounty = async () => {
    try {
      await act({
        variables: { id: item.id, sats: item.root.bounty },
        optimisticResponse: {
          act: {
            id: `Item:${item.id}`,
            sats: item.root.bounty
          }
        }
      })
    } catch (error) {
      if (error.toString().includes('insufficient funds')) {
        showModal(onClose => {
          return <FundError onClose={onClose} />
        })
        return
      }
      throw new Error({ message: error.toString() })
    }
  }

  if (!me || item.mine || item.root.user.name !== me.name) {
    return null
  }

  return (
    <ActionTooltip
      notForm
      overlayText={`${item.root.bounty} sats`}
    >
      <ModalButton
        clicker={
          <div className={styles.pay}>
            pay bounty
          </div>
        }
      >
        <div className='text-center font-weight-bold text-muted'>
          Pay this bounty to {item.user.name}?
        </div>
        <div className='text-center'>
          <Button className='mt-4' variant='primary' onClick={() => handlePayBounty()}>
            pay <small>{abbrNum(item.root.bounty)} sats</small>
          </Button>
        </div>
      </ModalButton>
    </ActionTooltip>
  )
}
