import { LightningConsumer } from './lightning'
import UpArrow from '../svgs/lightning-arrow.svg'
import styles from './upvote.module.css'
import { gql, useMutation } from '@apollo/client'

export default function UpVote ({ itemId, meSats, className, item }) {
  const [vote] = useMutation(
    gql`
      mutation vote($id: ID!, $sats: Int!) {
        vote(id: $id, sats: $sats)
      }`, {
      update (cache, { data: { vote } }) {
        if (item) {
          item.sats += vote
          item.meSats += vote
          return
        }
        cache.modify({
          id: `Item:${itemId}`,
          fields: {
            sats (existingSats = 0) {
              return existingSats + vote
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
          onClick={async () => {
            if (!itemId) return
            const { error } = await vote({ variables: { id: itemId, sats: 1 } })
            if (error) {
              throw new Error({ message: error.toString() })
            }

            strike()
          }}
        />}
    </LightningConsumer>
  )
}
