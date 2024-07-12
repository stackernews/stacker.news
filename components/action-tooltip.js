import { useFormikContext } from 'formik'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'

export default function ActionTooltip ({ children, notForm, disable, overlayText, placement }) {
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
      popperConfig={{
        modifiers: {
          preventOverflow: {
            enabled: false
          }
        }
      }}
    >
      <span>
        {children}
      </span>
    </OverlayTrigger>
  )
}
