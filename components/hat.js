import Badge from 'react-bootstrap/Badge'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import CowboyHatIcon from '../svgs/cowboy.svg'
import AnonIcon from '../svgs/spy-fill.svg'
import { numWithUnits } from '../lib/format'
import { ANON_USER_ID } from '../lib/constants'

export default function Hat ({ user, badge, className = 'ms-1', height = 16, width = 16 }) {
  if (!user) return null
  if (Number(user.id) === ANON_USER_ID) {
    return (
      <HatTooltip overlayText={badge ? 'anonymous' : 'posted anonymously'}>
        {badge
          ? (
            <Badge bg='grey-medium' className='ms-2 d-inline-flex align-items-center'>
              <AnonIcon className={`${className} align-middle`} height={height} width={width} />
            </Badge>)
          : <span><AnonIcon className={`${className} align-middle`} height={height} width={width} /></span>}
      </HatTooltip>
    )
  }

  if (user.streak === null || user.hideCowboyHat) {
    return null
  }

  const streak = user.streak
  return (
    <HatTooltip overlayText={streak
      ? `${numWithUnits(streak, { abbreviate: false, unitSingular: 'day', unitPlural: 'days' })}`
      : 'new'}
    >
      {badge
        ? (
          <Badge bg='grey-medium' className='ms-2 d-inline-flex align-items-center'>
            <CowboyHatIcon className={className} height={height} width={width} />
            <span className='ms-1 text-dark'>{streak || 'new'}</span>
          </Badge>)
        : <span><CowboyHatIcon className={className} height={height} width={width} /></span>}
    </HatTooltip>
  )
}

export function HatTooltip ({ children, overlayText, placement }) {
  return (
    <OverlayTrigger
      placement={placement || 'bottom'}
      overlay={
        <Tooltip>
          {overlayText}
        </Tooltip>
      }
      trigger={['hover', 'focus']}
    >
      {children}
    </OverlayTrigger>
  )
}
