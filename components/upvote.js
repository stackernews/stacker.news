import { LightningConsumer } from './lightning'
import UpArrow from '../svgs/lightning-arrow.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import { signIn, useSession } from 'next-auth/client'

export default function UpVote ({ itemId, meSats, className }) {
  const [session] = useSession()
  const [vote] = useMutation(
    gql`
      mutation vote($id: ID!, $sats: Int!) {
        vote(id: $id, sats: $sats)
      }`, {
      update (cache, { data: { vote } }) {
        cache.modify({
          id: `Item:${itemId}`,
          fields: {
            sats (existingSats = 0) {
              return existingSats || vote
            },
            boost (existingBoost = 0) {
              return meSats >= 1 ? existingBoost + vote : existingBoost
            },
            meSats (existingMeSats = 0) {
              return existingMeSats + vote
            }
          }
        })
      }
    }
  )

  return (
    <LightningConsumer>
      {({ strike }) =>
        <UpArrow
          width={24}
          height={24}
          className={
            `${styles.upvote}
            ${className || ''}
            ${meSats ? (meSats > 1 ? styles.stimi : styles.voted) : ''}`
          }
          onClick={
            session
              ? async () => {
                  if (!itemId) return
                  const { error } = await vote({ variables: { id: itemId, sats: 1 } })
                  if (error) {
                    throw new Error({ message: error.toString() })
                  }

                  strike()
                }
              : signIn
          }
        />}
    </LightningConsumer>
  )
}
