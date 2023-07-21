import Countdown from 'react-countdown'

export default function SimpleCountdown ({ className, onComplete, date }) {
  return (
    <span className={className}>
      <Countdown
        date={date}
        renderer={props => <span className='text-monospace' suppressHydrationWarning> {props.formatted.minutes}:{props.formatted.seconds}</span>}
        onComplete={onComplete}
      />
    </span>
  )
}
