import { useFormikContext } from 'formik'
import Tooltip from '@/components/ui/tooltip'

// transition is a no-op (everything animates now) and hideDelay has no
// passers; both stay in the signature so call sites don't error
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
    <Tooltip
      content={overlayText}
      side={placement || 'bottom'}
      delay={showDelay}
      closeDelay={hideDelay}
      disabled={formik?.isSubmitting}
    >
      {noWrapper ? children : <span>{children}</span>}
    </Tooltip>
  )
}
