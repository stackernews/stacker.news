import { useFormikContext } from 'formik'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'

export default function ActionTooltip ({ children, notForm, disable, overlayText, placement, noWrapper, showDelay, hideDelay, transition }) {
  // if we're in a form, we want to hide tooltip on submit
  let formik
  if (!notForm) {
    formik = useFormikContext()
  }
  if (disable || !overlayText) {
    return children
  }
  return (
    <OverlayTrigger
      placement={placement || 'bottom'}
      overlay={
        <Tooltip style={{ position: 'fixed' }}>
          {overlayText}
        </Tooltip>
      }
      trigger={['hover', 'focus']}
      show={formik?.isSubmitting ? false : undefined}
      delay={{ show: showDelay || 0, hide: hideDelay || 0 }}
      transition={transition || false}
      popperConfig={{
        modifiers: {
          preventOverflow: {
            enabled: false
          }
        }
      }}
    >
      {noWrapper ? children : <span>{children}</span>}
    </OverlayTrigger>
  )
}
