import { LightningConsumer } from './lightning'
import UpArrow from '../svgs/lightning-arrow.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'
import { signIn, useSession } from 'next-auth/client'
import { useFundError } from './fund-error'

export default function UpVote ({ itemId, meSats, className }) {
  const [session] = useSession()
  const { setError } = useFundError()
  const [vote] = useMutation(
    gql`
      mutation vote($id: ID!, $sats: Int!) {
        vote(id: $id, sats: $sats)
      }`, {
      update (cache, { data: { vote } }) {
        cache.modify({
          id: `Item:${itemId}`,
          fields: {
            meSats (existingMeSats = 0) {
              return existingMeSats + vote
            },
            sats (existingSats = 0) {
              return meSats === 0 ? existingSats + vote : existingSats
            },
            boost (existingBoost = 0) {
              return meSats >= 1 ? existingBoost + vote : existingBoost
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
              ? async (e) => {
                  e.stopPropagation()
                  strike()
                  if (!itemId) return
                  try {
                    await vote({ variables: { id: itemId, sats: 1 } })
                  } catch (error) {
                    if (error.toString().includes('insufficient funds')) {
                      setError(true)
                      return
                    }
                    throw new Error({ message: error.toString() })
                  }
                }
              : signIn
          }
        />}
    </LightningConsumer>
  )
}
