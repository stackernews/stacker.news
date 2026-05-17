import { Form, Input, SubmitButton } from './form'
import { subSeoSchema, subThemeSchema } from '@/lib/validate'
import { truncateDesc } from '@/lib/domains/seo'
import { useField, useFormikContext } from 'formik'
import { useState } from 'react'
import { useToast } from './toast'
import { PUBLIC_MEDIA_URL } from '@/lib/constants'
import { FileUpload } from './file-upload'
import { Button } from 'react-bootstrap'
import styles from './territory-customization.module.css'
import { useMutation, useQuery } from '@apollo/client/react'
import { GET_SUB_THEME, UPSERT_SUB_SEO, UPSERT_SUB_THEME } from '@/fragments/subs'
import SnIcon from '@/svgs/sn.svg'

// uploads via the presigned-POST flow; the form holds the upload id and the
// preview is either the freshly uploaded url, derived from that id, or a built-in fallback.
function AssetField ({ label, name, hint, defaultAsset, brand, width = 48, height = 48, accept = 'image/*', uploading, onUpload, onSuccess, onError }) {
  const [field, , helpers] = useField(name)
  const formik = useFormikContext()
  const [freshUrl, setFreshUrl] = useState(null)
  const toaster = useToast()

  const previewUrl = freshUrl || (field.value ? `${PUBLIC_MEDIA_URL}/${field.value}` : defaultAsset)

  return (
    <div className='mb-3'>
      <label className='form-label'>{label}</label>
      <div className='d-flex align-items-end gap-3'>
        <div className={styles.preview}>
          {previewUrl
            ? (
              <img
                src={previewUrl}
                alt={`${name} preview`}
                width={width}
                height={height}
                className={styles.previewImage}
              />
              )
            : brand
              ? (
                <SnIcon
                  width={64}
                  height={64}
                  style={{ fill: formik.values.primaryColor, filter: `drop-shadow(0 0 6px ${formik.values.primaryColor})` }}
                />
                )
              : null}
        </div>
        <div className='d-flex flex-column gap-2'>
          <div className='d-flex align-items-center gap-2'>
            <FileUpload
              allow={accept}
              avatar // only images allowed, free upload, no paid check
              onUpload={onUpload}
              onSuccess={({ id, url }) => {
                onSuccess()
                setFreshUrl(url)
                helpers.setValue(Number(id))
              }}
              onError={() => {
                onError()
                toaster.danger('upload failed')
              }}
            >
              <Button size='sm' variant='secondary' disabled={uploading}>
                {uploading ? 'uploading...' : (field.value ? 'replace' : 'upload')}
              </Button>
            </FileUpload>
            {field.value && (
              <Button
                size='sm' variant='danger'
                onClick={() => { helpers.setValue(null); setFreshUrl(null) }}
              >
                remove
              </Button>
            )}
          </div>
          {hint && <small className='text-muted'>{hint}</small>}
        </div>
      </div>
    </div>
  )
}

// SN defaults from styles/globals.scss
const SN_DEFAULTS = {
  primaryColor: '#FADA5E',
  secondaryColor: '#F6911D',
  linkColor: '#007cbe'
}

// if the value is the fallback, return null; otherwise, return the value
const normalizeColorOverride = (value, fallback) =>
  value && value !== fallback ? value : null

export function TerritoryThemeForm ({ sub, refetchSettings }) {
  const [upsertSubTheme] = useMutation(UPSERT_SUB_THEME)
  const { data } = useQuery(GET_SUB_THEME, {
    variables: { subName: sub.name },
    nextFetchPolicy: 'cache-and-network'
  })
  const [uploading, setUploading] = useState(false)

  const toaster = useToast()
  const theme = data?.subTheme

  const initial = {
    primaryColor: theme?.primaryColor ?? SN_DEFAULTS.primaryColor,
    secondaryColor: theme?.secondaryColor ?? SN_DEFAULTS.secondaryColor,
    linkColor: theme?.linkColor ?? SN_DEFAULTS.linkColor,
    logoId: theme?.logoId ?? null
  }

  const onSubmit = async (values) => {
    const input = {
      primaryColor: normalizeColorOverride(values.primaryColor, SN_DEFAULTS.primaryColor),
      secondaryColor: normalizeColorOverride(values.secondaryColor, SN_DEFAULTS.secondaryColor),
      linkColor: normalizeColorOverride(values.linkColor, SN_DEFAULTS.linkColor),
      logoId: values.logoId || null
    }

    try {
      await upsertSubTheme({ variables: { subName: sub.name, theme: input } })
      await refetchSettings?.()
      toaster.success('theme saved, may take a few minutes to take effect')
    } catch (error) {
      toaster.danger(error.message)
    }
  }

  return (
    <Form
      initial={initial}
      schema={subThemeSchema}
      enableReinitialize
      className='mt-2 mb-4'
      onSubmit={onSubmit}
    >
      <AssetField
        label='site logo'
        name='logoId'
        hint='shown in the nav (in place of the SN icon)'
        width={64}
        height={64}
        brand
        uploading={uploading}
        onUpload={() => setUploading(true)}
        onSuccess={() => setUploading(false)}
        onError={() => setUploading(false)}
      />
      <div className='row'>
        <Input
          groupClassName='col-4'
          label='primary color'
          name='primaryColor'
          type='color'
          className={styles.colorInput}
        />
        <Input
          groupClassName='col-4'
          label='secondary color'
          name='secondaryColor'
          type='color'
          className={styles.colorInput}
        />
        <Input
          groupClassName='col-4'
          label='link color'
          name='linkColor'
          type='color'
          className={styles.colorInput}
        />
      </div>
      <div className='mt-3 d-flex justify-content-end'>
        <SubmitButton variant='primary' disabled={uploading}>save theme</SubmitButton>
      </div>
    </Form>
  )
}

export function TerritorySeoForm ({ sub, seo, refetchSettings }) {
  const [upsertSubSeo] = useMutation(UPSERT_SUB_SEO)
  const [uploading, setUploading] = useState(false)

  const toaster = useToast()

  const initial = {
    title: seo?.title ?? '',
    tagline: seo?.tagline ?? '',
    faviconId: seo?.faviconId ?? null
  }

  const onSubmit = async (values) => {
    const input = {
      title: values.title?.trim() || null,
      tagline: values.tagline?.trim() || null,
      faviconId: values.faviconId || null
    }

    try {
      await upsertSubSeo({ variables: { subName: sub.name, seo: input } })
      await refetchSettings?.()
      toaster.success('SEO saved, may take a few minutes to take effect')
    } catch (error) {
      toaster.danger(error.message)
    }
  }

  return (
    <Form
      initial={initial}
      schema={subSeoSchema}
      enableReinitialize
      className='mt-2'
      onSubmit={onSubmit}
    >
      <AssetField
        label='site favicon'
        name='faviconId'
        hint='shown in browser tabs on your custom domain. 32x32 recommended'
        width={64}
        height={64}
        defaultAsset='/favicon.png'
        uploading={uploading}
        onUpload={() => setUploading(true)}
        onSuccess={() => setUploading(false)}
        onError={() => setUploading(false)}
      />
      <Input
        label='site title'
        name='title'
        placeholder={`~${sub?.name}`}
        hint='the page title of your territory, defaults to its name if left blank'
      />
      <Input
        as='textarea'
        rows={3}
        label='site tagline'
        name='tagline'
        placeholder={truncateDesc(sub?.desc, 120)}
        hint='the page description of your territory, defaults to the territory description if left blank'
      />
      <div className='mt-3 d-flex justify-content-end'>
        <SubmitButton variant='primary' disabled={uploading}>save SEO</SubmitButton>
      </div>
    </Form>
  )
}
