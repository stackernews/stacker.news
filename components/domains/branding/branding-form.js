import { Form, SubmitButton, ColorPicker } from '../../form'
// import { useMutation } from '@apollo/client'
import { useToast } from '../../toast'
import { brandingSchema } from '@/lib/validate'
// import { SET_TERRITORY_BRANDING } from '@/fragments/branding'

export default function BrandingForm ({ sub }) {
  // const [setTerritoryBranding] = useMutation(SET_TERRITORY_BRANDING)
  const toaster = useToast()

  const onSubmit = async (values) => {
    try {
      console.log(values)
      toaster.success('Branding updated successfully')
    } catch (error) {
      toaster.danger('Failed to update branding', { error })
    }
  }

  const initialValues = {
    primaryColor: sub?.branding?.primaryColor || '#FADA5E',
    secondaryColor: sub?.branding?.secondaryColor || '#F6911D'
  }

  // TODO: add logo and favicon upload
  // TODO: color picker is too big
  return (
    <Form
      initial={initialValues}
      schema={brandingSchema}
      onSubmit={onSubmit}
    >
      <ColorPicker label='primary color' name='primaryColor' />
      <ColorPicker label='secondary color' name='secondaryColor' />
      <SubmitButton variant='primary'>Save Branding</SubmitButton>
    </Form>
  )
}
