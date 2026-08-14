import { useFormikContext } from 'formik'
import Tooltip from '@/components/ui/tooltip'

export default function ActionTooltip ({ children, notForm, disable, overlayText, placement, noWrapper, showDelay }) {
  // if we're in a form, we want to hide tooltip on submit
  let formik
  if (!notForm) {
    formik = useFormikContext()
  }
  if (disable || !overlayText) {
    return children
  }
  return (
    <Tooltip
      content={overlayText}
      side={placement || 'bottom'}
      delay={showDelay}
      disabled={formik?.isSubmitting}
    >
      {noWrapper ? children : <span>{children}</span>}
    </Tooltip>
  )
}
