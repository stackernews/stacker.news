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

export function LongCountdown ({ className, onComplete, date }) {
  return (
    <span className={className}>
      <Countdown
        date={date}
        renderer={props => {
          return (
            <span suppressHydrationWarning>
              {props.formatted.days && `${props.formatted.days} days `}
              {props.formatted.minutes && `${props.formatted.minutes} minutes `}
              {props.formatted.seconds && `${props.formatted.seconds} seconds `}
            </span>
          )
        }}
        onComplete={onComplete}
      />
    </span>
  )
}
