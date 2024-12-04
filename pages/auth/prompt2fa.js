import { useRouter } from 'next/router'
import { useMutation } from '@apollo/client'
import gql from 'graphql-tag'
import { TOTPInputForm } from '@/components/totp'
import { useToast } from '@/components/toast'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { maybeSecureCookie } from '@/components/account'
import { StaticLayout } from '@/components/layout'
import { LogoutObstacle } from '@/components/nav/common'
import { useShowModal } from '@/components/modal'
import CancelButton from '@/components/cancel-button'
import { useCallback } from 'react'
export const getServerSideProps = getGetServerSideProps({ })

export default function Prompt2fa () {
  const router = useRouter()
  const toaster = useToast()
  const { callbackUrl, method } = router.query

  const [verify2fa] = useMutation(gql`
   mutation Verify2fa($method: String!, $token: String!, $callbackUrl: String) {
      verify2fa(method:$method, token: $token, callbackUrl: $callbackUrl) {
        result
        tokens {
          key
          value
        }
        callbackUrl
      }
    }
  `)
  const showModal = useShowModal()

  const logout = useCallback(() => {
    showModal((close) => {
      return (
        <LogoutObstacle onClose={close} />
      )
    })
  }, [])

  switch (method) {
    case 'totp':{
      return (
        <StaticLayout>
          <TOTPInputForm
            onCancel={logout}
            onSubmit={async (token) => {
              try {
                let res = await verify2fa({ variables: { method: 'totp', token, callbackUrl } })
                res = res.data.verify2fa
                console.log(res)
                if (!res.result) throw new Error('Invalid token')
                for (const { key, value } of res.tokens) {
                  document.cookie = maybeSecureCookie(`${key}=${value}; Path=/`)
                }
                router.push(res.callbackUrl)
              } catch (e) {
                console.error(e)
                toaster.danger(e.message)
              }
            }}
          />
        </StaticLayout>
      )
    }
    default:
      return (
        <StaticLayout>
          <h3>Unsupported 2fa method</h3>
          <CancelButton onClick={logout} />
        </StaticLayout>
      )
  }
}
