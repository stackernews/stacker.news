import { OverlayTrigger, Tooltip } from 'react-bootstrap'

export default function ActionTooltip ({ children }) {
  return (
    <OverlayTrigger
      placement='bottom'
      overlay={
        <Tooltip>
          1 sat
        </Tooltip>
      }
      trigger={['hover', 'focus']}
    >
      {children}
    </OverlayTrigger>
  )
}
