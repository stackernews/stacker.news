import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import cookie from 'cookie'
import { useMe } from '@/components/me'
import { USER_ID, SSR } from '@/lib/constants'
import { USER } from '@/fragments/users'
import { useApolloClient, useQuery } from '@apollo/client'
import { UserListRow } from '@/components/user-list'
import { Button } from 'react-bootstrap'
import { ITEM_FULL } from '@/fragments/items'

const AccountContext = createContext()

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')
const b64Encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64')

const maybeSecureCookie = cookie => {
  return window.location.protocol === 'https:' ? cookie + '; Secure' : cookie
}

export const AccountProvider = ({ children }) => {
  const { me } = useMe()
  const [accounts, setAccounts] = useState([])
  const [meAnon, setMeAnon] = useState(true)

  const updateAccountsFromCookie = useCallback(() => {
    try {
      const { multi_auth: multiAuthCookie } = cookie.parse(document.cookie)
      const accounts = multiAuthCookie
        ? JSON.parse(b64Decode(multiAuthCookie))
        : me ? [{ id: Number(me.id), name: me.name, photoId: me.photoId }] : []
      setAccounts(accounts)
      // required for backwards compatibility: sync cookie with accounts if no multi auth cookie exists
      // this is the case for sessions that existed before we deployed account switching
      if (!multiAuthCookie && !!me) {
        document.cookie = maybeSecureCookie(`multi_auth=${b64Encode(accounts)}; Path=/`)
      }
    } catch (err) {
      console.error('error parsing cookies:', err)
    }
  }, [setAccounts])

  useEffect(() => {
    updateAccountsFromCookie()
  }, [])

  const addAccount = useCallback(user => {
    setAccounts(accounts => [...accounts, user])
  }, [setAccounts])

  const removeAccount = useCallback(userId => {
    setAccounts(accounts => accounts.filter(({ id }) => id !== userId))
  }, [setAccounts])

  const multiAuthSignout = useCallback(async () => {
    const { status } = await fetch('/api/signout', { credentials: 'include' })
    // if status is 302, this means the server was able to switch us to the next available account
    // and the current account was simply removed from the list of available accounts including the corresponding JWT.
    const switchSuccess = status === 302
    if (switchSuccess) updateAccountsFromCookie()
    return switchSuccess
  }, [updateAccountsFromCookie])

  useEffect(() => {
    if (SSR) return
    const { 'multi_auth.user-id': multiAuthUserIdCookie } = cookie.parse(document.cookie)
    setMeAnon(multiAuthUserIdCookie === 'anonymous')
  }, [])

  const value = useMemo(
    () => ({ accounts, addAccount, removeAccount, meAnon, setMeAnon, multiAuthSignout }),
    [accounts, addAccount, removeAccount, meAnon, setMeAnon, multiAuthSignout])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export const useAccounts = () => useContext(AccountContext)

const AccountListRow = ({ account, ...props }) => {
  const { meAnon, setMeAnon } = useAccounts()
  const { me, refreshMe } = useMe()
  const anonRow = account.id === USER_ID.anon
  const selected = (meAnon && anonRow) || Number(me?.id) === Number(account.id)
  const client = useApolloClient()
  const router = useRouter()

  // fetch updated names and photo ids since they might have changed since we were issued the JWTs
  const [name, setName] = useState(account.name)
  const [photoId, setPhotoId] = useState(account.photoId)
  useQuery(USER,
    {
      variables: { id: account.id },
      onCompleted ({ user: { name, photoId } }) {
        if (photoId) setPhotoId(photoId)
        if (name) setName(name)
      }
    }
  )

  const onClick = async (e) => {
    // prevent navigation
    e.preventDefault()

    // update pointer cookie
    document.cookie = maybeSecureCookie(`multi_auth.user-id=${anonRow ? 'anonymous' : account.id}; Path=/`)

    // update state
    if (anonRow) {
      // order is important to prevent flashes of no session
      setMeAnon(true)
      await refreshMe()
    } else {
      await refreshMe()
      // order is important to prevent flashes of inconsistent data in switch account dialog
      setMeAnon(account.id === USER_ID.anon)
    }

    // account changes on some pages require a hard reload
    // 1) anons don't have access to some pages
    // ( search for 'authRequired: true' to find all such pages )
    const privatePages = ['/notifications', '/territory', '/items/[id]/edit', '/referrals', '/satistics', '/settings', '/wallet', '/~/edit']
    if (anonRow && privatePages.some(p => router.pathname.startsWith(p))) {
      router.reload()
      return
    }

    const authPages = ['/signup', '/login']
    // 2) if we're on /signup or /login, reload so we get redirected to the callback url
    if (!anonRow && authPages.some(p => router.pathname.startsWith(p))) {
      router.reload()
      return
    }

    // 3) not everyone has access to every item
    if (router.asPath.startsWith('/items')) {
      const itemId = router.asPath.split('/')[2]
      // check if we have access to the item
      const { item } = client.cache.readQuery({
        query: ITEM_FULL,
        variables: { id: itemId }
      })

      const isMine = item.userId === account.id
      const isPrivate = item.invoice && item.invoice.actionState !== 'PAID'

      if (!isMine && isPrivate) {
        router.reload()
        return
      }
    }

    await client.refetchQueries({
      include: 'active',
      onQueryUpdated: async (query) => {
        try {
          return await query.refetch()
        } catch (err) {
          const code = err.graphQLErrors?.[0]?.extensions?.code
          if (['FORBIDDEN', 'UNAUTHENTICATED', 'BAD_INPUT', 'BAD_USER_INPUT'].includes(code)) {
            return
          }

          // never throw but log unexpected errors
          console.error(err)
        }
      }
    })
  }

  return (
    <div className='d-flex flex-row'>
      <UserListRow
        user={{ ...account, photoId, name }}
        className='d-flex align-items-center me-2'
        {...props}
        onNymClick={onClick}
        selected={selected}
      />
    </div>
  )
}

export default function SwitchAccountList () {
  const { accounts } = useAccounts()
  const router = useRouter()
  const addAccount = () => {
    router.push({
      pathname: '/login',
      query: { callbackUrl: window.location.origin + router.asPath, multiAuth: true }
    })
  }
  // can't show hat since the streak is not included in the JWT payload
  return (
    <>
      <div className='my-2'>
        <div className='d-flex flex-column flex-wrap my-2'>
          <div className='fw-bold'>available accounts</div>
          <AccountListRow account={{ id: USER_ID.anon, name: 'anon' }} showHat={false} />
          {
            accounts.map((account) => <AccountListRow key={account.id} account={account} showHat={false} />)
          }
        </div>
        <Button variant='outline-grey-darkmode' onClick={addAccount}>
          add account
        </Button>
      </div>
    </>
  )
}
