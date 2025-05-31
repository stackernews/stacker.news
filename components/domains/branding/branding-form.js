import { Form, SubmitButton, ColorPicker, Input } from '../../form'
import { useMutation } from '@apollo/client'
import { useToast } from '../../toast'
import { brandingSchema } from '@/lib/validate'
import { SET_CUSTOM_BRANDING } from '@/fragments/brandings'

export default function BrandingForm ({ sub }) {
  const [setCustomBranding] = useMutation(SET_CUSTOM_BRANDING)
  const toaster = useToast()

  const onSubmit = async (values) => {
    console.log(values)
    try {
      await setCustomBranding({
        variables: {
          subName: sub.name,
          branding: values
        }
      })
      toaster.success('Branding updated successfully')
    } catch (error) {
      console.error(error)
      toaster.danger('Failed to update branding', { error })
    }
  }

  const initialValues = {
    title: sub?.branding?.title || sub?.subName,
    primaryColor: sub?.branding?.primaryColor || '#FADA5E',
    secondaryColor: sub?.branding?.secondaryColor || '#F6911D',
    logoId: sub?.branding?.logoId || null,
    faviconId: sub?.branding?.faviconId || null
  }

  // TODO: add logo and favicon upload
  // TODO: color picker is too big
  return (
    <Form
      initial={initialValues}
      schema={brandingSchema}
      onSubmit={onSubmit}
    >
      <Input label='Title' name='title' />
      <ColorPicker label='primary color' name='primaryColor' />
      <ColorPicker label='secondary color' name='secondaryColor' />
      {/* TODO: add logo and favicon upload */}
      <SubmitButton variant='primary'>Save Branding</SubmitButton>
    </Form>
  )
}
