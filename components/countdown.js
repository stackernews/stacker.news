import Countdown from 'react-countdown'

export default function SimpleCountdown ({ className, onComplete, date }) {
  return (
    <span className={className || 'text-muted font-weight-bold'}>
      <Countdown
        date={date}
        renderer={props => <span> {props.formatted.minutes}:{props.formatted.seconds}</span>}
        onComplete={onComplete}
      />
    </span>
  )
}
