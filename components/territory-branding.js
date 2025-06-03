import { useToast } from '@/components/toast'
import { SUB_BRANDING, UPSERT_SUB_BRANDING } from '@/fragments/subs'
import { useMutation, useQuery } from '@apollo/client'
import { subBrandingSchema } from '@/lib/validate'
import { Form, Input, ColorPicker, SubmitButton } from '@/components/form'
import AccordianItem from '@/components/accordian-item'

export default function TerritoryBrandingForm ({ sub }) {
  const [upsertSubBranding] = useMutation(UPSERT_SUB_BRANDING)
  const toaster = useToast()

  const { data } = useQuery(SUB_BRANDING, {
    variables: { subName: sub.name }
  })

  const subBranding = data?.sub?.branding

  const onSubmit = async (values) => {
    try {
      await upsertSubBranding({
        variables: {
          subName: sub.name,
          branding: {
            title: values.title,
            description: values.description,
            primaryColor: values.primary,
            secondaryColor: values.secondary,
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
    title: subBranding?.title || sub?.name,
    description: subBranding?.description || '',
    primaryColor: subBranding?.primaryColor || '#FADA5E',
    secondaryColor: subBranding?.secondaryColor || '#F6911D',
    logoId: subBranding?.logoId || null,
    faviconId: subBranding?.faviconId || null
  }

  return (
    <Form
      initial={initialValues}
      schema={subBrandingSchema}
      onSubmit={onSubmit}
    >
      <Input label='title' name='title' />
      <Input label='description' name='description' />
      <div className='row'>
        <ColorPicker groupClassName='col-4' label='primary color' name='primary' />
        <ColorPicker groupClassName='col-4' label='secondary color' name='secondary' />
      </div>
      <AccordianItem
        header={<div className='fw-bold text-muted'>logo and favicon</div>}
        body={
          <div className='row'>
            <div className='col-2'>
              <label className='form-label'>logo</label>
              <div style={{ position: 'relative', width: '100px', height: '100px', border: '1px solid #dee2e6', borderRadius: '5px', overflow: 'hidden' }}>
                <p>placeholder</p>
                {/* <BrandingUpload name='logoId' /> */}
              </div>
            </div>
            <div className='col-2'>
              <label className='form-label'>favicon</label>
              <div style={{ position: 'relative', width: '100px', height: '100px', border: '1px solid #dee2e6', borderRadius: '5px', overflow: 'hidden' }}>
                <p>placeholder</p>
                {/* <BrandingUpload name='faviconId' /> */}
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
