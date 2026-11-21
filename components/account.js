import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { USER_ID } from '@/lib/constants'
import { USER } from '@/fragments/users'
import { useQuery } from '@apollo/client/react'
import { UserListRow } from '@/components/user-list'
import useCookie from '@/components/use-cookie'
import { useShowModal } from '@/components/modal'
import { MenuItem, MenuSeparator } from '@/components/ui/menu'
import AddIcon from '@/svgs/add-fill.svg'
import { cookieOptions, MULTI_AUTH_ANON, MULTI_AUTH_LIST, MULTI_AUTH_POINTER } from '@/lib/auth'
import { useBranding } from '@/components/territory-branding'

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')

const MAX_MENU_ACCOUNTS = 4

export const nextAccount = async () => {
  const { status } = await fetch('/api/next-account', { method: 'POST', credentials: 'include' })
  // if status is 302, this means the server was able to switch us to the next available account
  return status === 302
}

export default function SwitchAccountList () {
  const accounts = useAccounts()
  const [pointerCookie] = useCookie(MULTI_AUTH_POINTER)
  const addAccount = useAddAccount()

  return (
    <>
      <div className='my-2'>
        <div className='flex flex-col flex-wrap mt-2 mb-4'>
          <h4 className='text-muted'>Accounts</h4>
          <AccountListRow
            account={{ id: USER_ID.anon, name: 'anon' }}
            selected={pointerCookie === MULTI_AUTH_ANON}
            showHat={false}
          />
          {
            accounts.map((account) =>
              <AccountListRow
                key={account.id}
                account={account}
                selected={Number(pointerCookie) === account.id}
                showHat={false}
              />)
          }
        </div>
        <button type='button' onClick={addAccount} className='text-reset font-bold'>
          <AddIcon height={20} width={20} /> add account
        </button>
      </div>
    </>
  )
}

const AccountListRow = ({ account, selected, ...props }) => {
  const user = useAccountProfile(account)
  const switchAccount = useSwitchAccount()

  const onClick = (e) => {
    // prevent navigation
    e.preventDefault()
    switchAccount(account)
  }

  return (
    <div className='flex flex-row'>
      <UserListRow
        user={user}
        className='flex items-center me-2'
        selected={selected}
        {...props}
        onNymClick={onClick}
      />
    </div>
  )
}

export function SwitchAccountMenuItems () {
  const accounts = useAccounts()
  const showModal = useShowModal()
  const addAccount = useAddAccount()

  return (
    <>
      {accounts.slice(0, MAX_MENU_ACCOUNTS).map(account => (
        <AccountMenuItem key={account.id} account={account} />
      ))}
      {accounts.length > MAX_MENU_ACCOUNTS && (
        <MenuItem onClick={() => showModal(onClose => <SwitchAccountList onClose={onClose} />)}>
          all accounts
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem onClick={addAccount}>add account</MenuItem>
    </>
  )
}

function AccountMenuItem ({ account }) {
  const { name } = useAccountProfile(account)
  const switchAccount = useSwitchAccount()

  return <MenuItem onClick={() => switchAccount(account)}>@{name}</MenuItem>
}

// names and photos can change after the JWTs were issued
function useAccountProfile (account) {
  const { data, error } = useQuery(USER, { variables: { id: account.id } })
  if (error) console.error(`query for user ${account.id} failed:`, error)

  return {
    ...account,
    name: data?.user?.name || account.name,
    photoId: data?.user?.photoId || account.photoId
  }
}

function useSwitchAccount () {
  const router = useRouter()
  const [, setPointerCookie] = useCookie(MULTI_AUTH_POINTER)

  return useCallback((account) => {
    const anon = account.id === USER_ID.anon
    setPointerCookie(anon ? MULTI_AUTH_ANON : account.id, cookieOptions({ httpOnly: false }))

    // reload whatever page we're on to avoid any bugs due to missing authorization etc.
    router.reload()
  }, [router, setPointerCookie])
}

function useAddAccount () {
  const router = useRouter()
  const [, setPointerCookie] = useCookie(MULTI_AUTH_POINTER)

  // on @anon a login adds the account instead of linking it to the current one
  return useCallback(() => {
    setPointerCookie(MULTI_AUTH_ANON, cookieOptions({ httpOnly: false }))
    router.push({ pathname: '/login', query: { callbackUrl: window.location.origin + router.asPath } })
  }, [router, setPointerCookie])
}

export const useIsLurker = () => {
  const accounts = useAccounts()
  const branding = useBranding()
  if (branding) return false

  return accounts.length === 0
}

export const useAccounts = () => {
  const [listCookie] = useCookie(MULTI_AUTH_LIST)
  return listCookie ? JSON.parse(b64Decode(listCookie)) : []
}
