import { useEffect, useState } from 'react'
import { Form, Input, SNInput } from '@/components/form'
import { useRouter } from 'next/router'
import { gql, useLazyQuery } from '@apollo/client'
import AdvPostForm from './adv-post-form'
import { ITEM_FIELDS } from '@/fragments/items'
import Item from './item'
import AccordianItem from './accordian-item'
import { linkSchema } from '@/lib/validate'
import Moon from '@/svgs/moon-fill.svg'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { ItemButtonBar } from './post'
import { UPSERT_LINK } from '@/fragments/payIn'
import { usePostFormShared } from './use-post-form-shared'
import useDebounceCallback from './use-debounce-callback'
import { ensureProtocol } from '@/lib/url'

const LOOKUP_DEBOUNCE_MS = 500
const DUPES_DEBOUNCE_MS = 500

function getMeaningfulUrl (value) {
  try {
    const normalized = ensureProtocol(value)
    const url = new URL(normalized)
    return url.hostname.includes('.') || url.hostname === 'localhost' ? normalized : null
  } catch {
    return null
  }
}

export function LinkForm ({ item, subs, EditInfo, children }) {
  const router = useRouter()
  // if Web Share Target API was used
  const shareUrl = router.query.url

  const { initial, onSubmit, client, storageKeyPrefix, schema } = usePostFormShared({
    item,
    subs,
    mutation: UPSERT_LINK,
    schemaFn: linkSchema,
    storageKeyPrefix: 'link',
    extraInitialValues: {
      url: item?.url || shareUrl || ''
    }
  })

  const isEditing = !!item
  const [currentTitle, setCurrentTitle] = useState(initial.title || '')

  // allows finer control over dupe accordian layout shift
  const [dupes, setDupes] = useState()
  const [titleOverride, setTitleOverride] = useState()

  const [getPageTitleAndUnshorted, { data, loading: pageTitleLoading }] = useLazyQuery(gql`
    query PageTitleAndUnshorted($url: String!) {
      pageTitleAndUnshorted(url: $url) {
        title
        unshorted
      }
    }`)
  const [getDupes, { data: dupesData, loading: dupesLoading }] = useLazyQuery(gql`
    ${ITEM_FIELDS}
    query Dupes($url: String!) {
      dupes(url: $url) {
        ...ItemFields
      }
    }`)
  const getPageTitleAndUnshortedDebounce = useDebounceCallback((...args) => getPageTitleAndUnshorted(...args), LOOKUP_DEBOUNCE_MS, [getPageTitleAndUnshorted])
  const getDupesDebounce = useDebounceCallback((...args) => getDupes(...args), DUPES_DEBOUNCE_MS, [getDupes])

  useEffect(() => {
    if (!dupesLoading) {
      setDupes(dupesData?.dupes)
    }
  }, [dupesLoading, dupesData])

  useEffect(() => {
    const canOverrideTitle = !currentTitle.trim() || currentTitle === titleOverride

    if (!isEditing && data?.pageTitleAndUnshorted?.title && canOverrideTitle) {
      setTitleOverride(data.pageTitleAndUnshorted.title)
    }
  }, [data?.pageTitleAndUnshorted?.title, currentTitle, titleOverride, isEditing])

  useEffect(() => {
    const unshorted = getMeaningfulUrl(data?.pageTitleAndUnshorted?.unshorted)

    if (unshorted) {
      getDupesDebounce({
        variables: { url: unshorted }
      })
    }
  }, [data?.pageTitleAndUnshorted?.unshorted, getDupesDebounce])

  const postDisabled = !item && (pageTitleLoading || dupesLoading)

  return (
    <Form
      initial={initial}
      schema={schema}
      onSubmit={onSubmit}
      storageKeyPrefix={storageKeyPrefix}
    >
      {children}
      <Input
        label='title'
        name='title'
        overrideValue={titleOverride}
        required
        clear
        onChange={async (formik, e) => {
          setCurrentTitle(e.target.value)

          if (isEditing) {
            return
          }

          if (titleOverride && e.target.value !== titleOverride) {
            setTitleOverride(undefined)
          }
        }}
        maxLength={MAX_TITLE_LENGTH}
      />
      <Input
        label='url'
        name='url'
        required
        autoFocus
        clear
        autoComplete='off'
        overrideValue={data?.pageTitleAndUnshorted?.unshorted}
        hint={EditInfo}
        onChange={async (formik, e) => {
          const value = e.target.value

          if (isEditing) {
            return
          }

          const meaningfulUrl = getMeaningfulUrl(value)

          if (!meaningfulUrl) {
            setDupes(undefined)
            client.cache.modify({
              fields: {
                pageTitleAndUnshorted () {
                  return null
                }
              }
            })
            return
          }

          const hasTitle = !!formik?.values.title.trim().length && formik?.values.title.trim() !== titleOverride
          const hasDraftTitle = !!window.localStorage.getItem('link-title')?.trim()?.length
          const isUnshortedOverride = !!data?.pageTitleAndUnshorted?.unshorted && value === data.pageTitleAndUnshorted.unshorted

          if (!hasTitle && !hasDraftTitle && !isUnshortedOverride) {
            getPageTitleAndUnshortedDebounce({
              variables: { url: meaningfulUrl }
            })
          } else {
            client.cache.modify({
              fields: {
                pageTitleAndUnshorted () {
                  return null
                }
              }
            })
          }

          getDupesDebounce({
            variables: { url: meaningfulUrl }
          })
        }}
      />
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item}>
        <SNInput
          label='context'
          name='text'
          minRows={2}
        />
      </AdvPostForm>
      <ItemButtonBar itemId={item?.id} disable={postDisabled}>
        {!item && postDisabled &&
          <div className='d-flex align-items-center small'>
            <Moon className='spin fill-grey' height={16} width={16} />
            <div className='ms-2 text-muted'>searching for dupes</div>
          </div>}
      </ItemButtonBar>
      {!item &&
        <>
          {dupes?.length > 0 &&
            <div className='mt-3'>
              <AccordianItem
                show
                headerColor='#c03221'
                header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>dupes</div>}
                body={
                  <div>
                    {dupes.map((item, i) => (
                      <Item item={item} key={item.id} />
                    ))}
                  </div>
              }
              />
            </div>}
        </>}
    </Form>
  )
}
