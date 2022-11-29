import React, {useState} from "react"
import styles from "./pay-bounty.module.css"
import ActionTooltip from './action-tooltip'
import { useMutation, gql } from "@apollo/client"
import { signIn } from 'next-auth/client'
import {useMe} from "./me"

export default function PayBounty({ children, item, bounty }) {
    const me = useMe()

    const fwd2me = me && me?.id === item?.fwdUser?.id

    const [act] = useMutation(
        gql`
          mutation act($id: ID!, $sats: Int!) {
            act(id: $id, sats: $sats) {
              vote,
              sats
            }
          }`, {
          update (cache, { data: { act: { vote, sats } } }) {
            cache.modify({
              id: `Item:${item.id}`,
              fields: {
                sats (existingSats = 0) {
                  return existingSats + sats
                },
                meSats (existingSats = 0) {
                // If we keep upvotes below we can use this to show the user's vote
                //   if (existingSats === 0) {
                //     setVoteShow(true)
                //   } else {
                //     setTipShow(true)
                //   }
                  return existingSats + sats
                },
                // Do we need an upvote to happen as well?
                // upvotes (existingUpvotes = 0) {
                //   return existingUpvotes + vote
                // }
              }
            })
    
            // update all ancestors
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
          }
        }
      )

    const handlePayBounty = async () => {
        if (!me) {
            signIn()
            return
        }
        act({ variables: { id: item.id, sats: bounty } })
    }

    if (item.root.user.name !== me.name || item.mine) {
        return null
    }

    const bountyPaidToComment = () => {
        if (item.bountyPaid) {
            return (
                <div className={styles.pay}>
                    BOUNTY REAWRDED
                </div>
            )
        }
        return null
    }

    // If the user has received an amount of sats equal to the bounty from the OP, show the bounty reward text

    return (
        <div className={styles.payContainer} onClick={() => handlePayBounty()}>
            <ActionTooltip notForm disable={item?.mine || fwd2me} overlayText={`${bounty} sats`}>
                <div className={styles.pay}>pay-bounty</div>
            </ActionTooltip>
        </div>
    )
}