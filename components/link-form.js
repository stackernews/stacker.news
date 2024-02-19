import { useState, useEffect, useCallback } from 'react'
import { Form, Input, MarkdownInput } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { ITEM_FIELDS } from '../fragments/items'
import Item from './item'
import AccordianItem from './accordian-item'
import { linkSchema } from '../lib/validate'
import Moon from '../svgs/moon-fill.svg'
import { normalizeForwards, toastDeleteScheduled } from '../lib/form'
import { useToast } from './toast'
import { SubSelectInitial } from './sub-select'
import { MAX_TITLE_LENGTH } from '../lib/constants'
import useCrossposter from './use-crossposter'
import { useMe } from './me'
import { ItemButtonBar } from './post'

export function LinkForm ({ item, sub, editThreshold, children }) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const toaster = useToast()
  const schema = linkSchema({ client, me, existingBoost: item?.boost })
  // if Web Share Target API was used
  const shareUrl = router.query.url
  const shareTitle = router.query.title

  const crossposter = useCrossposter()

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
    }`, {
    onCompleted: () => setPostDisabled(false)
  })
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

  const [upsertLink] = useMutation(
    gql`
      mutation upsertLink($sub: String, $id: ID, $title: String!, $url: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
        upsertLink(sub: $sub, id: $id, title: $title, url: $url, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
          id
          deleteScheduledAt
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ boost, crosspost, title, ...values }) => {
      const { data, error } = await upsertLink({
        variables: {
          sub: item?.subName || sub?.name,
          id: item?.id,
          boost: boost ? Number(boost) : undefined,
          title: title.trim(),
          ...values,
          forward: normalizeForwards(values.forward)
        }
      })
      if (error) {
        throw new Error({ message: error.toString() })
      }

      const linkId = data?.upsertLink?.id

      if (crosspost && linkId) {
        await crossposter(linkId)
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
      toastDeleteScheduled(toaster, data, 'upsertLink', !!item, values.text)
    }, [upsertLink, router]
  )

  useEffect(() => {
    if (data?.pageTitleAndUnshorted?.title) {
      setTitleOverride(data.pageTitleAndUnshorted.title)
    }
  }, [data?.pageTitleAndUnshorted?.title])

  useEffect(() => {
    if (data?.pageTitleAndUnshorted?.unshorted) {
      getDupes({
        variables: { url: data?.pageTitleAndUnshorted?.unshorted }
      })
    }
  }, [data?.pageTitleAndUnshorted?.unshorted])

  const [postDisabled, setPostDisabled] = useState(false)
  const [titleOverride, setTitleOverride] = useState()

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
      invoiceable
      onSubmit={onSubmit}
      storageKeyPrefix={item ? undefined : 'link'}
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
          ? <div className='text-muted fw-bold'><Countdown date={editThreshold} /></div>
          : null}
        onChange={async (formik, e) => {
          if ((/^ *$/).test(formik?.values.title)) {
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
            setTimeout(() => setPostDisabled(false), 3000)
            getDupes({
              variables: { url: e.target.value }
            })
          }
        }}
      />
      <AdvPostForm edit={!!item} item={item}>
        <MarkdownInput
          label='context'
          name='text'
          minRows={2}
          // https://github.com/Andarist/react-textarea-autosize/pull/371
          style={{ width: 'auto' }}
        />
      </AdvPostForm>
      <ItemButtonBar itemId={item?.id} disable={postDisabled}>
        {!item && dupesLoading &&
          <div className='d-flex justify-content-center'>
            <Moon className='spin fill-grey' />
            <div className='ms-2 text-muted' style={{ fontWeight: '600' }}>searching for dupes</div>
          </div>}
      </ItemButtonBar>
      {!item &&
        <>
          {dupesData?.dupes?.length > 0 &&
            <div className='mt-3'>
              <AccordianItem
                show
                headerColor='#c03221'
                header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>dupes</div>}
                body={
                  <div>
                    {dupesData.dupes.map((item, i) => (
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
