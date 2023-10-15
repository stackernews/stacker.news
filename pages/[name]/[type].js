import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import { useRouter } from 'next/router'
import { USER, USER_WITH_ITEMS } from '../../fragments/users'
import { useQuery } from '@apollo/client'
import { COMMENT_TYPE_QUERY, ITEM_SORTS, ITEM_TYPES, WHENS_CUSTOM as WHENS } from '../../lib/constants'
import PageLoading from '../../components/page-loading'
import { UserLayout } from '.'
import { Form, Select, DatePicker } from '../../components/form'
import { useState } from 'react'

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
        <Items
          ssrData={ssrData}
          variables={variables}
          query={USER_WITH_ITEMS}
        />
      </div>
    </UserLayout>
  )
}

function UserItemsHeader ({ type, name }) {
  const router = useRouter()
  async function select (values) {
    let { type, ...query } = values
    if (!type || type === 'all' || !ITEM_TYPES('user').includes(type)) type = 'all'
    if (!query.by || query.by === 'recent' || !ITEM_SORTS.includes(query.by)) delete query.by
    if (!query.when || query.when === 'forever' || !WHENS.includes(query.when) || query.when === 'forever') delete query.when
    if (!query.when === 'custom') {
      delete query.from
      delete query.to
    }
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
  const from = router.query.from || new Date().toISOString()
  const to = router.query.to || new Date().toISOString()

  const [datePicker, setDatePicker] = useState(when === 'custom' && router.query.when === 'custom')
  // The following state is needed for the date picker (and driven by the date picker).
  // Substituting router.query or formik values would cause network lag and/or timezone issues.
  const [range, setRange] = useState({ start: new Date(from), end: new Date(to) })

  return (
    <Form
      initial={{ type, by, when }}
      onSubmit={select}
    >
      <div className='text-muted fw-bold mt-0 mb-3 d-flex justify-content-start align-items-center flex-wrap'>
        <div className='text-muted fw-bold mt-0 mb-3 d-flex justify-content-start align-items-center'>
          <Select
            groupClassName='mb-0 me-2'
            className='w-auto'
            name='type'
            size='sm'
            overrideValue={type}
            items={ITEM_TYPES('user')}
            onChange={(formik, e) => select({ ...formik?.values, type: e.target.value })}
          />
          by
          <Select
            groupClassName='mb-0 mx-2'
            className='w-auto'
            name='by'
            size='sm'
            overrideValue={by}
            items={['recent', ...ITEM_SORTS]}
            onChange={(formik, e) => select({ ...formik?.values, by: e.target.value })}
          />
          for
          <Select
            groupClassName='mb-0 mx-2'
            className='w-auto'
            name='when'
            size='sm'
            items={WHENS}
            overrideValue={when}
            onChange={(formik, e) => {
              select({ ...formik?.values, when: e.target.value, from: from || new Date().toISOString(), to: to || new Date().toISOString() })
              setDatePicker(e.target.value === 'custom')
              if (e.target.value === 'custom') setRange({ start: new Date(), end: new Date() })
            }}
          />
        </div>
        {datePicker &&
          <DatePicker
            fromName='from' toName='to'
            className='form-control p-0 px-2 mb-3 text-center'
            onMount={() => {
              setRange({ start: new Date(from), end: new Date(to) })
              return [from, to]
            }}
            onChange={(formik, [start, end], e) => {
              setRange({ start, end })
              select({ ...formik?.values, from: start && start.toISOString(), to: end && end.toISOString() })
            }}
            selected={range.start}
            startDate={range.start} endDate={range.end}
            selectsRange
            dateFormat='MM/dd/yy'
            maxDate={new Date()}
            minDate={new Date('2021-05-01')}
          />}
      </div>
    </Form>
  )
}
