import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap'
import CowboyHatIcon from '../svgs/cowboy.svg'

export default function CowboyHat ({ streak, badge, className = 'ml-1', height = 16, width = 16 }) {
  if (streak === null) {
    return null
  }

  return (
    <HatTooltip overlayText={streak ? `${streak} days` : 'new'}>
      {badge
        ? (
          <Badge variant='grey-medium' className='ml-2 d-inline-flex align-items-center'>
            <CowboyHatIcon className={className} height={height} width={width} />
            <span className='ml-1'>{streak || 'new'}</span>
          </Badge>)
        : <CowboyHatIcon className={className} height={height} width={width} />}
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
