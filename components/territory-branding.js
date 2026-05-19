import { Form, Input, SubmitButton } from './form'
import { subBrandingSchema } from '@/lib/validate'
import { truncateDesc } from '@/lib/domains/seo'
import { useField, useFormikContext } from 'formik'
import { createContext, useContext, useEffect, useState } from 'react'
import { useToast } from './toast'
import { FileUpload } from './file-upload'
import { Button } from 'react-bootstrap'
import styles from './territory-branding.module.css'
import { useMutation, useQuery } from '@apollo/client/react'
import { UPSERT_SUB_BRANDING } from '@/fragments/subs'
import { GET_DOMAIN } from '@/fragments/domains'
import SnIcon from '@/svgs/sn.svg'
import { PUBLIC_MEDIA_URL, DOMAIN_POLL_INTERVAL_MS } from '@/lib/constants'
import AccordianItem from './accordian-item'
import TerritoryDomains from './territory-domains'

// shape: { subName, primaryColor?, secondaryColor?, linkColor?, logoId?, title, tagline, faviconId? } | null
// produced by getDomainBranding at SSR and threaded through ssrApollo -> BrandingProvider.
const BrandingContext = createContext(null)

export const BrandingProvider = ({ branding: ssrBranding, children }) => {
  const [branding, setBranding] = useState(ssrBranding ?? null)

  // keep the SSR value flowing through client-side navigation,
  // including nodata transitions where pageProps may briefly drop the prop
  useEffect(() => {
    if (ssrBranding !== undefined) {
      setBranding(ssrBranding)
    }
  }, [ssrBranding])

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  )
}

/** returns the active custom-domain branding for this request, or null on the main site */
export const useBranding = () => useContext(BrandingContext)

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
              subAsset // only images allowed, free upload
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

// section label
const SectionHeading = ({ children, className = '' }) => (
  <div
    className={`text-muted text-uppercase mt-4 mb-2 ${className}`}
    style={{ fontWeight: 'bold', fontSize: '82%', letterSpacing: '0.04em' }}
  >
    {children}
  </div>
)

export function TerritoryBrandingForm ({ sub, branding }) {
  const [upsertSubBranding] = useMutation(UPSERT_SUB_BRANDING)
  const [uploading, setUploading] = useState(false)

  const toaster = useToast()

  const initial = {
    primaryColor: branding?.primaryColor ?? SN_DEFAULTS.primaryColor,
    secondaryColor: branding?.secondaryColor ?? SN_DEFAULTS.secondaryColor,
    linkColor: branding?.linkColor ?? SN_DEFAULTS.linkColor,
    logoId: branding?.logoId ?? null,
    title: branding?.title ?? '',
    tagline: branding?.tagline ?? '',
    faviconId: branding?.faviconId ?? null
  }

  const onSubmit = async (values) => {
    const input = {
      primaryColor: normalizeColorOverride(values.primaryColor, SN_DEFAULTS.primaryColor),
      secondaryColor: normalizeColorOverride(values.secondaryColor, SN_DEFAULTS.secondaryColor),
      linkColor: normalizeColorOverride(values.linkColor, SN_DEFAULTS.linkColor),
      logoId: values.logoId || null,
      title: values.title?.trim() || null,
      tagline: values.tagline?.trim() || null,
      faviconId: values.faviconId || null
    }

    try {
      await upsertSubBranding({ variables: { subName: sub.name, branding: input } })
      toaster.success('branding saved, may take a few minutes to take effect')
    } catch (error) {
      toaster.danger(error.message)
    }
  }

  return (
    <Form
      initial={initial}
      schema={subBrandingSchema}
      enableReinitialize
      className='mt-2'
      onSubmit={onSubmit}
    >
      <SectionHeading className='mt-2'>appearance</SectionHeading>
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
      <SectionHeading>discovery (seo)</SectionHeading>
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
        <SubmitButton variant='primary' disabled={uploading}>save branding</SubmitButton>
      </div>
    </Form>
  )
}

export default function TerritoryBranding ({ sub }) {
  const domain = sub.domain ?? null
  const branding = sub.branding ?? null
  const hasDomain = !!domain

  const pollInterval = domain?.status === 'PENDING' ? DOMAIN_POLL_INTERVAL_MS : 0
  // cache write propagates to SUB_EDIT, we don't need to refetch the entire sub
  useQuery(GET_DOMAIN, {
    variables: { subName: sub.name },
    fetchPolicy: 'cache-first',
    pollInterval,
    skip: !hasDomain
  })

  return (
    <div className='w-100'>
      <AccordianItem
        show={hasDomain}
        header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>advanced</div>}
        body={
          <>
            <TerritoryDomains
              sub={sub}
              domain={domain}
            />
            {hasDomain && <TerritoryBrandingForm sub={sub} branding={branding} />}
          </>
        }
      />
    </div>
  )
}
