import { gql, useMutation } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { fixedDecimal } from '../lib/format'
import { timeLeft } from '../lib/time'
import { useMe } from './me'
import styles from './poll.module.css'
import Check from '../svgs/checkbox-circle-fill.svg'
import { signIn } from 'next-auth/react'
import ActionTooltip from './action-tooltip'
import { useShowModal } from './modal'
import FundError from './fund-error'

export default function Poll ({ item }) {
  const me = useMe()
  const showModal = useShowModal()
  const [pollVote] = useMutation(
    gql`
      mutation pollVote($id: ID!) {
        pollVote(id: $id)
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
    return (
      <ActionTooltip placement='left' notForm>
        <Button
          variant='outline-info' className={styles.pollButton}
          onClick={me
            ? async () => {
              try {
                await pollVote({
                  variables: { id: v.id },
                  optimisticResponse: {
                    pollVote: v.id
                  }
                })
              } catch (error) {
                if (error.toString().includes('insufficient funds')) {
                  showModal(onClose => {
                    return <FundError onClose={onClose} />
                  })
                }
              }
            }
            : signIn}
        >
          {v.option}
        </Button>
      </ActionTooltip>
    )
  }

  const expiresIn = timeLeft(new Date(+new Date(item.createdAt) + 864e5))
  const mine = item.user.id === me?.id
  return (
    <div className={styles.pollBox}>
      {item.poll.options.map(v =>
        expiresIn && !item.poll.meVoted && !mine
          ? <PollButton key={v.id} v={v} />
          : <PollResult
              key={v.id} v={v}
              progress={item.poll.count ? fixedDecimal(v.count * 100 / item.poll.count, 1) : 0}
            />)}
      <div className='text-muted mt-1'>{item.poll.count} votes \ {expiresIn ? `${expiresIn} left` : 'poll ended'}</div>
    </div>
  )
}

function PollResult ({ v, progress }) {
  return (
    <div className={styles.pollResult}>
      <span className={styles.pollOption}>{v.option}{v.meVoted && <Check className='fill-grey ms-1 align-self-center' width={18} height={18} />}</span>
      <span className='ms-auto me-2 align-self-center'>{progress}%</span>
      <div className={styles.pollProgress} style={{ width: `${progress}%` }} />
    </div>
  )
}
