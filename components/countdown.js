import Countdown from 'react-countdown'

export default function SimpleCountdown (props) {
  return (
    <CountdownShared
      {...props} formatter={props => {
        return (
          <>
            {props.formatted.minutes}:{props.formatted.seconds}
          </>
        )
      }}
    />
  )
}

export function LongCountdown (props) {
  return (
    <CountdownShared
      {...props} formatter={props => {
        return (
          <>
            {props.formatted.days && `${props.formatted.days} days `}
            {props.formatted.hours && `${props.formatted.hours} hours `}
            {props.formatted.minutes && `${props.formatted.minutes} minutes `}
            {props.formatted.seconds && `${props.formatted.seconds} seconds `}
          </>
        )
      }}
    />
  )
}

export function CompactLongCountdown (props) {
  return (
    <CountdownShared
      {...props} formatter={props => {
        return (
          <>
            {Number(props.formatted.days) > 0
              ? ` ${props.formatted.days}d ${props.formatted.hours}h ${props.formatted.minutes}m ${props.formatted.seconds}s`
              : Number(props.formatted.hours) > 0
                ? ` ${props.formatted.hours}:${props.formatted.minutes}:${props.formatted.seconds}`
                : Number(props.formatted.minutes) > 0
                  ? ` ${props.formatted.minutes}:${props.formatted.seconds}`
                  : Number(props.formatted.seconds) > 0
                    ? ` ${props.formatted.seconds}s`
                    : ' '}
          </>
        )
      }}
    />
  )
}

function CountdownShared ({ className, onComplete, date, formatter }) {
  return (
    <span className={className}>
      <Countdown
        date={date}
        renderer={props => {
          return (
            <span suppressHydrationWarning>
              {formatter(props)}
            </span>
          )
        }}
        onComplete={onComplete}
      />
    </span>
  )
}
