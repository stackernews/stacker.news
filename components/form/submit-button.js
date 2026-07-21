import { useFormikContext } from 'formik'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/button'

// NOTE: 'main' is a PHANTOM variant (no skin here or anywhere pre-C9a) — the two
// variantless sites paint the bare .btn base, same as rb's unstyled btn-main (§18)
export function SubmitButton ({
  children, variant, valueName = 'submit', value, onClick, disabled, appendText, submittingText,
  className, ...props
}) {
  const formik = useFormikContext()

  disabled ||= formik.isSubmitting
  submittingText ||= children

  return (
    <Button
      variant={variant || 'main'}
      className={cn(formik.isSubmitting && 'pulse', className)}
      type='submit'
      disabled={disabled}
      onClick={value
        ? e => {
          formik.setFieldValue(valueName, value)
          onClick && onClick(e)
        }
        : onClick}
      {...props}
    >
      {formik.isSubmitting
        ? submittingText
        : (
          <>
            {children}
            {appendText && <small> {appendText}</small>}
          </>
          )}
    </Button>
  )
}
