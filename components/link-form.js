import { useState, useEffect, useCallback } from 'react'
import { Form, Input, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { ITEM_FIELDS } from '../fragments/items'
import Item from './item'
import AccordianItem from './accordian-item'
import FeeButton, { EditFeeButton } from './fee-button'
import Delete from './delete'
import Button from 'react-bootstrap/Button'
import { linkSchema } from '../lib/validate'
import Moon from '../svgs/moon-fill.svg'
import { SubSelectInitial } from './sub-select-form'
import CancelButton from './cancel-button'
import { useInvoiceable } from './invoice'

export function LinkForm ({ item, sub, editThreshold, children }) {
  const router = useRouter()
  const client = useApolloClient()
  const schema = linkSchema(client)
  // if Web Share Target API was used
  const shareUrl = router.query.url
  const shareTitle = router.query.title

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
      mutation upsertLink($sub: String, $id: ID, $title: String!, $url: String!, $boost: Int, $forward: String, $invoiceHash: String, $invoiceHmac: String) {
        upsertLink(sub: $sub, id: $id, title: $title, url: $url, boost: $boost, forward: $forward, invoiceHash: $invoiceHash, invoiceHmac: $invoiceHmac) {
          id
        }
      }`
  )

  const submitUpsertLink = useCallback(
    async (_, boost, title, values, invoiceHash, invoiceHmac) => {
      const { error } = await upsertLink({
        variables: { sub: item?.subName || sub?.name, id: item?.id, boost: boost ? Number(boost) : undefined, title: title.trim(), invoiceHash, invoiceHmac, ...values }
      })
      if (error) {
        throw new Error({ message: error.toString() })
      }
      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
    }, [upsertLink, router])

  const invoiceableUpsertLink = useInvoiceable(submitUpsertLink)

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
        ...AdvPostInitial({ forward: item?.fwdUser?.name }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
      schema={schema}
      onSubmit={async ({ boost, title, cost, ...values }) => {
        return invoiceableUpsertLink(cost, boost, title, values)
      }}
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
          if (e.target.value === e.target.value.toUpperCase()) {
            setTitleOverride(e.target.value.replace(/\w\S*/g, txt =>
              txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()))
          }
        }}
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
      <AdvPostForm edit={!!item} />
      <div className='mt-3'>
        {item
          ? (
            <div className='d-flex justify-content-between'>
              <Delete itemId={item.id} onDelete={() => router.push(`/items/${item.id}`)}>
                <Button variant='grey-medium'>delete</Button>
              </Delete>
              <div className='d-flex'>
                <CancelButton />
                <EditFeeButton
                  paidSats={item.meSats}
                  parentId={null} text='save' ChildButton={SubmitButton} variant='secondary'
                />
              </div>
            </div>)
          : (
            <div className='d-flex align-items-center'>
              <FeeButton
                baseFee={1} parentId={null} text='post' disabled={postDisabled}
                ChildButton={SubmitButton} variant='secondary'
              />
              {dupesLoading &&
                <div className='d-flex ms-3 justify-content-center'>
                  <Moon className='spin fill-grey' />
                  <div className='ms-2 text-muted' style={{ fontWeight: '600' }}>searching for dupes</div>
                </div>}
            </div>
            )}
      </div>
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
