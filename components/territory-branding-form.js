import { Form, SubmitButton, ColorPicker, Input } from './form'
import { useMutation } from '@apollo/client'
import { useToast } from './toast'
import { brandingSchema } from '@/lib/validate'
import { SET_CUSTOM_BRANDING } from '@/fragments/brandings'
import AccordianItem from './accordian-item'

export default function BrandingForm ({ sub }) {
  const [setCustomBranding] = useMutation(SET_CUSTOM_BRANDING)
  const toaster = useToast()

  const onSubmit = async (values) => {
    console.log(values)
    try {
      await setCustomBranding({
        variables: {
          subName: sub.name,
          branding: {
            title: values.title,
            colors: {
              primary: values.primary,
              secondary: values.secondary,
              info: values.info,
              success: values.success,
              danger: values.danger
            },
            logoId: values.logoId,
            faviconId: values.faviconId
          }
        }
      })
      toaster.success('Branding updated successfully')
    } catch (error) {
      console.error(error)
      toaster.danger('Failed to update branding', { error })
    }
  }

  const initialValues = {
    title: sub?.customBranding?.title || sub?.subName,
    primary: sub?.customBranding?.colors?.primary || '#FADA5E',
    secondary: sub?.customBranding?.colors?.secondary || '#F6911D',
    info: sub?.customBranding?.colors?.info || '#007cbe',
    success: sub?.customBranding?.colors?.success || '#5c8001',
    danger: sub?.customBranding?.colors?.danger || '#c03221',
    logoId: sub?.customBranding?.logoId || null,
    faviconId: sub?.customBranding?.faviconId || null
  }

  // TODO: add logo and favicon upload
  return (
    <Form
      initial={initialValues}
      schema={brandingSchema} // TODO: branding schema
      onSubmit={onSubmit}
    >
      <Input label='title' name='title' />
      <div className='row'>
        <ColorPicker groupClassName='col-4' label='primary color' name='primary' />
        <ColorPicker groupClassName='col-4' label='secondary color' name='secondary' />
      </div>
      <AccordianItem
        header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>more colors</div>}
        body={
          <div className='row'>
            <ColorPicker groupClassName='col-4' label='info color' name='info' />
            <ColorPicker groupClassName='col-4' label='success color' name='success' />
            <ColorPicker groupClassName='col-4' label='danger color' name='danger' />
          </div>
        }
      />
      <div className='mt-3 d-flex justify-content-end'>
        <SubmitButton variant='primary'>save branding</SubmitButton>
      </div>
    </Form>
  )
}
