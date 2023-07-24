import Badge from 'react-bootstrap/Badge'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import CowboyHatIcon from '../svgs/cowboy.svg'

export default function CowboyHat ({ user, badge, className = 'ms-1', height = 16, width = 16 }) {
  if (user?.streak === null || user.hideCowboyHat) {
    return null
  }

  const streak = user.streak
  return (
    <HatTooltip overlayText={streak ? `${streak} days` : 'new'}>
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

function HatTooltip ({ children, overlayText, placement }) {
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
