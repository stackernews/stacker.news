import { Form, Input, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useLazyQuery, useMutation } from '@apollo/client'
import ActionTooltip from '../components/action-tooltip'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'
import { ITEM_FIELDS } from '../fragments/items'
import Item from './item'
import AccordianItem from './accordian-item'

// eslint-disable-next-line
const URL = /^((https?|ftp):\/\/)?(www.)?(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i
export const LinkSchema = Yup.object({
  title: Yup.string().required('required').trim(),
  url: Yup.string().matches(URL, 'invalid url').required('required'),
  ...AdvPostSchema
})

export function LinkForm ({ item, editThreshold }) {
  const router = useRouter()

  const [getPageTitle, { data }] = useLazyQuery(gql`
    query PageTitle($url: String!) {
      pageTitle(url: $url)
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

  const [createLink] = useMutation(
    gql`
      mutation createLink($title: String!, $url: String!, $boost: Int, $forward: String) {
        createLink(title: $title, url: $url, boost: $boost, forward: $forward) {
          id
        }
      }`
  )

  const [updateLink] = useMutation(
    gql`
      mutation updateLink($id: ID!, $title: String!, $url: String!, $forward: String) {
        updateLink(id: $id, title: $title, url: $url, forward: $forward) {
          id
          title
          url
        }
      }`, {
      update (cache, { data: { updateLink } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            title () {
              return updateLink.title
            },
            url () {
              return updateLink.url
            }
          }
        })
      }
    }
  )

  return (
    <Form
      initial={{
        title: item?.title || '',
        url: item?.url || '',
        ...AdvPostInitial
      }}
      schema={LinkSchema}
      onSubmit={async ({ boost, ...values }) => {
        let error
        if (item) {
          ({ error } = await updateLink({ variables: { ...values, id: item.id } }))
        } else {
          ({ error } = await createLink({ variables: { boost: Number(boost), ...values } }))
        }
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
        overrideValue={data?.pageTitle}
        required
      />
      <Input
        label='url'
        name='url'
        required
        autoFocus
        hint={editThreshold
          ? <div className='text-muted font-weight-bold'><Countdown date={editThreshold} /></div>
          : null}
        onChange={async (formik, e) => {
          if ((/^ *$/).test(formik?.values.title)) {
            getPageTitle({
              variables: { url: e.target.value }
            })
          }
          getDupes({
            variables: { url: e.target.value }
          })
        }}
      />
      {!item && <AdvPostForm />}
      <ActionTooltip>
        <SubmitButton variant='secondary' className='mt-3'>{item ? 'save' : 'post'}</SubmitButton>
      </ActionTooltip>
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

    </Form>
  )
}
