import { useFormikContext } from 'formik'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'

export default function ActionTooltip ({ children, notForm }) {
  // if we're in a form, we want to hide tooltip on submit
  let formik
  if (!notForm) {
    formik = useFormikContext()
  }
  return (
    <OverlayTrigger
      placement='bottom'
      overlay={
        <Tooltip>
          1 sat
        </Tooltip>
      }
      trigger={['hover', 'focus']}
      show={formik?.isSubmitting ? false : undefined}
    >
      {children}
    </OverlayTrigger>
  )
}
