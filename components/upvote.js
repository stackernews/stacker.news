import { LightningConsumer } from './lightning'
import UpArrow from '../svgs/lightning-arrow.svg'
import styles from './upvote.module.css'

export default function UpVote ({ className }) {
  return (
    <LightningConsumer>
      {({ strike }) =>
        <UpArrow
          width={24}
          height={24}
          className={`${styles.upvote} ${className || ''}`}
          onClick={strike}
        />}
    </LightningConsumer>
  )
}
