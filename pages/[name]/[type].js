import { getGetServerSideProps } from '@/api/ssrApollo'
import Items from '@/components/items'
import { CustomBookmarkList } from '@/components/bookmark'
import { useRouter } from 'next/router'
import { USER, USER_WITH_ITEMS } from '@/fragments/users'
import { useQuery } from '@apollo/client'
import { COMMENT_TYPE_QUERY, ITEM_SORTS, ITEM_TYPES_USER, WHENS } from '@/lib/constants'
import PageLoading from '@/components/page-loading'
import { UserLayout } from '.'
import { Form, Select, DatePicker } from '@/components/form'
import { whenToFrom } from '@/lib/time'

const staticVariables = { sort: 'user' }
const variablesFunc = vars => ({
  includeComments: COMMENT_TYPE_QUERY.includes(vars.type),
  ...staticVariables,
  ...vars
})
export const getServerSideProps = getGetServerSideProps(
  { query: USER_WITH_ITEMS, variables: variablesFunc, notFound: data => !data.user })

export default function UserItems ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)

  const { data } = useQuery(USER, { variables })
  if (!data && !ssrData) return <PageLoading />

  const { user } = data || ssrData

  return (
    <UserLayout user={user}>
      <div className='mt-2'>
        <UserItemsHeader type={variables.type} name={user.name} />
        {variables.type === 'bookmarks' && variables.by === 'custom'
          ? (
            <CustomBookmarkList
              ssrData={ssrData}
              variables={variables}
              query={USER_WITH_ITEMS}
            />
            )
          : (
            <Items
              ssrData={ssrData}
              variables={variables}
              query={USER_WITH_ITEMS}
            />)}
      </div>
    </UserLayout>
  )
}

function UserItemsHeader ({ type, name }) {
  const router = useRouter()
  async function select (values) {
    let { type, ...query } = values
    if (!type || type === 'all' || !ITEM_TYPES_USER.includes(type)) type = 'all'
    if (!query.by || query.by === 'recent' || !ITEM_SORTS.includes(query.by)) delete query.by
    if (!query.when || query.when === 'forever' || !WHENS.includes(query.when) || query.when === 'forever') delete query.when
    if (query.when !== 'custom') { delete query.from; delete query.to }
    if (query.from && !query.to) return

    await router.push({
      pathname: `/${name}/${type}`,
      query
    })
  }

  type ||= router.query.type || 'all'
  const by = router.query.by || 'recent'
  const when = router.query.when || 'forever'

  return (
    <Form
      initial={{ type, by, when, from: '', to: '' }}
      onSubmit={select}
    >
      <div className='text-muted fw-bold d-flex align-items-center flex-wrap'>
        <div className='text-muted fw-bold mb-2 d-flex align-items-center'>
          <Select
            groupClassName='mb-0 me-2'
            name='type'
            size='sm'
            overrideValue={type}
            items={ITEM_TYPES_USER}
            onChange={(formik, e) => select({ ...formik?.values, type: e.target.value })}
          />
          by
          <Select
            groupClassName='mb-0 mx-2'
            name='by'
            size='sm'
            overrideValue={by}
            items={['recent', ...ITEM_SORTS]}
            onChange={(formik, e) => select({ ...formik?.values, by: e.target.value })}
          />
          for
          <Select
            groupClassName='mb-0 mx-2'
            name='when'
            size='sm'
            items={WHENS}
            overrideValue={when}
            onChange={(formik, e) => {
              const range = e.target.value === 'custom' ? { from: whenToFrom(when), to: Date.now() } : {}
              select({ ...formik?.values, when: e.target.value, ...range })
            }}
          />
        </div>
        {when === 'custom' &&
          <DatePicker
            fromName='from' toName='to'
            className='p-0 px-2'
            onChange={(formik, [from, to], e) => {
              select({ ...formik?.values, from: from.getTime(), to: to.getTime() })
            }}
            from={router.query.from}
            to={router.query.to}
            when={when}
          />}
      </div>
      {type === 'bookmarks' && by === 'custom' && (
        <div className='text-muted small mb-2'>
          Drag and drop bookmarks to reorder them.
        </div>
      )}
    </Form>
  )
}
