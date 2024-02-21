import { gql, useMutation } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { fixedDecimal, numWithUnits } from '../lib/format'
import { timeLeft } from '../lib/time'
import { useMe } from './me'
import styles from './poll.module.css'
import Check from '../svgs/checkbox-circle-fill.svg'
import { signIn } from 'next-auth/react'
import ActionTooltip from './action-tooltip'
import { POLL_COST } from '../lib/constants'
import { payOrLoginError, useInvoiceModal } from './invoice'

export default function Poll ({ item }) {
  const me = useMe()
  const [pollVote] = useMutation(
    gql`
      mutation pollVote($id: ID!, $hash: String, $hmac: String) {
        pollVote(id: $id, hash: $hash, hmac: $hmac)
      }`, {
      update (cache, { data: { pollVote } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            poll (existingPoll) {
              const poll = { ...existingPoll }
              poll.meVoted = true
              poll.count += 1
              return poll
            }
          }
        })
        cache.modify({
          id: `PollOption:${pollVote}`,
          fields: {
            count (existingCount) {
              return existingCount + 1
            },
            meVoted () {
              return true
            }
          }
        })
      }
    }
  )

  const PollButton = ({ v }) => {
    const showInvoiceModal = useInvoiceModal(async ({ hash, hmac }, { variables }) => {
      await pollVote({ variables: { ...variables, hash, hmac } })
    }, [pollVote])

    const variables = { id: v.id }

    return (
      <ActionTooltip placement='left' notForm>
        <Button
          variant='outline-info' className={styles.pollButton}
          onClick={me
            ? async () => {
              try {
                await pollVote({
                  variables,
                  optimisticResponse: {
                    pollVote: v.id
                  }
                })
              } catch (error) {
                if (payOrLoginError(error)) {
                  showInvoiceModal({ amount: item.pollCost || POLL_COST }, { variables })
                  return
                }
                throw new Error({ message: error.toString() })
              }
            }
            : signIn}
        >
          {v.option}
        </Button>
      </ActionTooltip>
    )
  }

  const hasExpiration = !!item.pollExpiresAt
  const timeRemaining = timeLeft(new Date(item.pollExpiresAt))
  const mine = item.user.id === me?.id
  const showPollButton = (!hasExpiration || timeRemaining) && !item.poll.meVoted && !mine
  return (
    <div className={styles.pollBox}>
      {item.poll.options.map(v =>
        showPollButton
          ? <PollButton key={v.id} v={v} />
          : <PollResult
              key={v.id} v={v}
              progress={item.poll.count ? fixedDecimal(v.count * 100 / item.poll.count, 1) : 0}
            />)}
      <div className='text-muted mt-1'>
        {numWithUnits(item.poll.count, { unitSingular: 'vote', unitPlural: 'votes' })}
        {hasExpiration && ` \\ ${timeRemaining ? `${timeRemaining} left` : 'poll ended'}`}
      </div>
    </div>
  )
}

function PollResult ({ v, progress }) {
  return (
    <div className={styles.pollResult}>
      <span className={styles.pollOption}>{v.option}{v.meVoted && <Check className='fill-grey ms-1 align-self-center flex-shrink-0' width={16} height={16} />}</span>
      <span className='ms-auto me-2 align-self-center'>{progress}%</span>
      <div className={styles.pollProgress} style={{ width: `${progress}%` }} />
    </div>
  )
}
