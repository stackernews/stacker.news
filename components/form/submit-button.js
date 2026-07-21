import { useFormikContext } from 'formik'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/button'

// note that 'main' is a phantom variant with no skin anywhere: the two
// variantless sites paint the bare .btn base, same as the old unstyled btn-main
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
