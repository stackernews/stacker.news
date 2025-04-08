import { Form, SubmitButton, ColorPicker, Input, BrandingUpload } from './form'
import { useMutation } from '@apollo/client'
import { useToast } from './toast'
import { customBrandingSchema } from '@/lib/validate'
import { SET_CUSTOM_BRANDING } from '@/fragments/brandings'
import AccordianItem from './accordian-item'

export default function BrandingForm ({ sub }) {
  const [setCustomBranding] = useMutation(SET_CUSTOM_BRANDING)
  const toaster = useToast()

  const onSubmit = async (values) => {
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

  const customBranding = sub?.customBranding || {}
  const subColors = customBranding?.colors || {}

  const initialValues = {
    title: customBranding?.title || sub?.name,
    primary: subColors?.primary || '#FADA5E',
    secondary: subColors?.secondary || '#F6911D',
    info: subColors?.info || '#007cbe',
    success: subColors?.success || '#5c8001',
    danger: subColors?.danger || '#c03221',
    logoId: customBranding?.logoId || null,
    faviconId: customBranding?.faviconId || null
  }

  return (
    <Form
      initial={initialValues}
      schema={customBrandingSchema}
      onSubmit={onSubmit}
    >
      <Input label='title' name='title' />
      <div className='row'>
        <ColorPicker groupClassName='col-4' label='primary color' name='primary' />
        <ColorPicker groupClassName='col-4' label='secondary color' name='secondary' />
      </div>
      <AccordianItem
        header={<div className='fw-bold text-muted'>more colors</div>}
        body={
          <div className='row'>
            <ColorPicker groupClassName='col-4' label='info color' name='info' />
            <ColorPicker groupClassName='col-4' label='success color' name='success' />
            <ColorPicker groupClassName='col-4' label='danger color' name='danger' />
          </div>
        }
      />
      <AccordianItem
        header={<div className='fw-bold text-muted'>logo and favicon</div>}
        body={
          <div className='row'>
            <div className='col-2'>
              <label className='form-label'>logo</label>
              <div style={{ position: 'relative', width: '100px', height: '100px', border: '1px solid #dee2e6', borderRadius: '5px', overflow: 'hidden' }}>
                <BrandingUpload name='logoId' />
              </div>
            </div>
            <div className='col-2'>
              <label className='form-label'>favicon</label>
              <div style={{ position: 'relative', width: '100px', height: '100px', border: '1px solid #dee2e6', borderRadius: '5px', overflow: 'hidden' }}>
                <BrandingUpload name='faviconId' />
              </div>
            </div>
          </div>
        }
      />
      <div className='mt-3 d-flex justify-content-end'>
        <SubmitButton variant='primary'>save branding</SubmitButton>
      </div>
    </Form>
  )
}
