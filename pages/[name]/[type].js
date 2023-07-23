import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import { useRouter } from 'next/router'
import { USER_WITH_ITEMS } from '../../fragments/users'
import { useQuery } from '@apollo/client'
import { COMMENT_TYPE_QUERY, ITEM_SORTS, ITEM_TYPES, WHENS } from '../../lib/constants'
import PageLoading from '../../components/page-loading'
import { UserLayout } from '.'
import { Form, Select } from '../../components/form'

const staticVariables = { sort: 'user' }
const variablesFunc = vars =>
  ({ includeComments: COMMENT_TYPE_QUERY.includes(vars.type), ...staticVariables, ...vars })
export const getServerSideProps = getGetServerSideProps(USER_WITH_ITEMS, variablesFunc, data => !data.user)

export default function UserItems ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)

  const { data } = useQuery(USER_WITH_ITEMS, { variables })
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
    if (!type || !ITEM_TYPES('user').includes(type)) type = 'all'
    if (!query.by || !ITEM_SORTS.includes(query.by)) delete query.by
    if (!query.when || !WHENS.includes(query.when) || query.when === 'forever') delete query.when

    await router.push({
      pathname: `/${name}/${type}`,
      query
    })
  }

  return (
    <Form
      initial={{
        type,
        by: router.query.by || 'recent',
        when: router.query.when || 'forever'
      }}
      onSubmit={select}
    >
      <div className='text-muted font-weight-bold mt-0 mb-3 d-flex justify-content-start align-items-center'>
        <Select
          groupClassName='mb-0 mr-2'
          className='w-auto'
          name='type'
          size='sm'
          items={ITEM_TYPES('user')}
          onChange={(formik, e) => select({ ...formik?.values, type: e.target.value })}
        />
        by
        <Select
          groupClassName='mb-0 mx-2'
          className='w-auto'
          name='by'
          size='sm'
          items={['recent', ...ITEM_SORTS]}
          onChange={(formik, e) => select({ ...formik?.values, by: e.target.value })}
        />
        for
        <Select
          groupClassName='mb-0 ml-2'
          className='w-auto'
          name='when'
          size='sm'
          items={WHENS}
          onChange={(formik, e) => select({ ...formik?.values, when: e.target.value })}
        />
      </div>
    </Form>
  )
}
