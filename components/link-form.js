import { useState, useEffect } from 'react'
import { Form, Input, MarkdownInput } from '@/components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { ITEM_FIELDS } from '@/fragments/items'
import Item from './item'
import AccordianItem from './accordian-item'
import { linkSchema } from '@/lib/validate'
import Moon from '@/svgs/moon-fill.svg'
import { normalizeForwards } from '@/lib/form'
import { SubSelectInitial } from './sub-select'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { useMe } from './me'
import { ItemButtonBar } from './post'
import { UPSERT_LINK } from '@/fragments/paidAction'
import useItemSubmit from './use-item-submit'
import useDebounceCallback from './use-debounce-callback'

export function LinkForm ({ item, sub, editThreshold, children }) {
  const router = useRouter()
  const client = useApolloClient()
  const { me } = useMe()
  const schema = linkSchema({ client, me, existingBoost: item?.boost })
  // if Web Share Target API was used
  const shareUrl = router.query.url
  const shareTitle = router.query.title
  // allows finer control over dupe accordian layout shift
  const [dupes, setDupes] = useState()

  const [getPageTitleAndUnshorted, { data }] = useLazyQuery(gql`
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
  const [getRelated, { data: relatedData }] = useLazyQuery(gql`
    ${ITEM_FIELDS}
    query related($title: String!) {
      related(title: $title, minMatch: "75%", limit: 3) {
        items {
          ...ItemFields
        }
      }
    }`)

  const related = []
  for (const item of relatedData?.related?.items || []) {
    let found = false
    for (const ditem of dupesData?.dupes || []) {
      if (ditem.id === item.id) {
        found = true
        break
      }
    }

    if (!found) {
      related.push(item)
    }
  }

  const onSubmit = useItemSubmit(UPSERT_LINK, { item, sub })

  const getDupesDebounce = useDebounceCallback((...args) => getDupes(...args), 1000, [getDupes])

  useEffect(() => {
    if (data?.pageTitleAndUnshorted?.title) {
      setTitleOverride(data.pageTitleAndUnshorted.title)
    }
  }, [data?.pageTitleAndUnshorted?.title])

  useEffect(() => {
    if (!dupesLoading) {
      setDupes(dupesData?.dupes)
    }
  }, [dupesLoading, dupesData, setDupes])

  useEffect(() => {
    if (data?.pageTitleAndUnshorted?.unshorted) {
      getDupesDebounce({
        variables: { url: data?.pageTitleAndUnshorted?.unshorted }
      })
    }
  }, [data?.pageTitleAndUnshorted?.unshorted, getDupesDebounce])

  const [postDisabled, setPostDisabled] = useState(false)
  const [titleOverride, setTitleOverride] = useState()

  const storageKeyPrefix = item ? undefined : 'link'

  return (
    <Form
      initial={{
        title: item?.title || shareTitle || '',
        url: item?.url || shareUrl || '',
        text: item?.text || '',
        crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
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
          if (e.target.value) {
            getRelated({
              variables: { title: e.target.value }
            })
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
        hint={editThreshold
          ? <div className='text-muted fw-bold font-monospace'><Countdown date={editThreshold} /></div>
          : null}
        onChange={async (formik, e) => {
          const hasTitle = !!(formik?.values.title.trim().length > 0)
          const hasDraftTitle = !!(window.localStorage.getItem('link-title')?.trim()?.length > 0)
          if (!hasTitle && !hasDraftTitle) {
            getPageTitleAndUnshorted({
              variables: { url: e.target.value }
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
          if (e.target.value) {
            setPostDisabled(true)
            setTimeout(() => setPostDisabled(false), 2000)
            getDupesDebounce({
              variables: { url: e.target.value }
            })
          }
        }}
      />
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item} sub={sub}>
        <MarkdownInput
          label='context'
          name='text'
          minRows={2}
          // https://github.com/Andarist/react-textarea-autosize/pull/371
          style={{ width: 'auto' }}
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
          <div className={`mt-3 ${related.length > 0 ? '' : 'invisible'}`}>
            <AccordianItem
              header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>similar</div>}
              body={
                <div>
                  {related.map((item, i) => (
                    <Item item={item} key={item.id} />
                  ))}
                </div>
              }
            />
          </div>
        </>}
    </Form>
  )
}
