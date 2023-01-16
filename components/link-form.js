import { Form, Input, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'
import { ITEM_FIELDS } from '../fragments/items'
import Item from './item'
import AccordianItem from './accordian-item'
import { MAX_TITLE_LENGTH } from '../lib/constants'
import { URL_REGEXP } from '../lib/url'
import FeeButton, { EditFeeButton } from './fee-button'
import Delete from './delete'
import { Button } from 'react-bootstrap'

export function LinkForm ({ item, editThreshold }) {
  const router = useRouter()
  const client = useApolloClient()

  const [getPageTitleAndUnshorted, { data }] = useLazyQuery(gql`
    query PageTitleAndUnshorted($url: String!) {
      pageTitleAndUnshorted(url: $url) {
        title
        unshorted
      }
    }`, {
    fetchPolicy: 'network-only'
  })
  const [getDupes, { data: dupesData }] = useLazyQuery(gql`
  ${ITEM_FIELDS}
  query Dupes($url: String!) {
    dupes(url: $url) {
      ...ItemFields
    }
  }`, {
    fetchPolicy: 'network-only'
  })
  const [getRelated, { data: relatedData }] = useLazyQuery(gql`
  ${ITEM_FIELDS}
  query related($title: String!) {
    related(title: $title, minMatch: "75%", limit: 3) {
      items {
        ...ItemFields
      }
    }
  }`, {
    fetchPolicy: 'network-only'
  })

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
      mutation upsertLink($id: ID, $title: String!, $url: String!, $boost: Int, $forward: String) {
        upsertLink(id: $id, title: $title, url: $url, boost: $boost, forward: $forward) {
          id
        }
      }`
  )

  const LinkSchema = Yup.object({
    title: Yup.string().required('required').trim()
      .max(MAX_TITLE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`),
    url: Yup.string().matches(URL_REGEXP, 'invalid url').required('required'),
    ...AdvPostSchema(client)
  })

  return (
    <Form
      initial={{
        title: item?.title || '',
        url: item?.url || '',
        ...AdvPostInitial({ forward: item?.fwdUser?.name })
      }}
      schema={LinkSchema}
      onSubmit={async ({ boost, title, ...values }) => {
        const { error } = await upsertLink({
          variables: { id: item?.id, boost: Number(boost), title: title.trim(), ...values }
        })
        if (error) {
          throw new Error({ message: error.toString() })
        }
        if (item) {
          await router.push(`/items/${item.id}`)
        } else {
          await router.push('/recent')
        }
      }}
      storageKeyPrefix={item ? undefined : 'link'}
    >
      <Input
        label='title'
        name='title'
        overrideValue={data?.pageTitleAndUnshorted?.title}
        required
        clear
        onChange={async (formik, e) => {
          if (e.target.value) {
            getRelated({
              variables: { title: e.target.value }
            })
          }
        }}
      />
      <Input
        label='url'
        name='url'
        required
        autoFocus
        clear
        overrideValue={data?.pageTitleAndUnshorted?.unshorted}
        hint={editThreshold
          ? <div className='text-muted font-weight-bold'><Countdown date={editThreshold} /></div>
          : null}
        onChange={async (formik, e) => {
          if ((/^ *$/).test(formik?.values.title)) {
            getPageTitleAndUnshorted({
              variables: { url: e.target.value }
            })
          }
          getDupes({
            variables: { url: e.target.value }
          })
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
              <EditFeeButton
                paidSats={item.meSats}
                parentId={null} text='save' ChildButton={SubmitButton} variant='secondary'
              />
            </div>)
          : <FeeButton
              baseFee={1} parentId={null} text='post'
              ChildButton={SubmitButton} variant='secondary'
            />}
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
