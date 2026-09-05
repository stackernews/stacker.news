import * as cookie from 'cookie'
import { StaticLayout } from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback } from 'react'
import { Form, SubmitButton, OtpInput } from '@/components/form'
import { emailTokenSchema } from '@/lib/validate'
import ArrowRightLineIcon from '@/svgs/arrow-right-line.svg'
import LoopVideo from '@/components/loop-video'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function Email () {
  const router = useRouter()
  const [callback, setCallback] = useState(null) // callback.email, callback.callbackUrl
  const [signin, setSignin] = useState(false)

  useEffect(() => {
    setSignin(!!cookie.parse(document.cookie).signin)
    setCallback(JSON.parse(window.sessionStorage.getItem('callback')))
  }, [])

  // build and push the final callback URL
  const pushCallback = useCallback((token) => {
    const params = new URLSearchParams()
    if (callback.callbackUrl) params.set('callbackUrl', callback.callbackUrl)
    params.set('token', token)
    params.set('email', callback.email.toLowerCase())
    const url = `/api/auth/callback/email?${params.toString()}`
    router.push(url)
  }, [callback, router])

  const buildMessage = () => {
    const email = callback?.email || 'your email address'
    return signin
      ? `if there's a match, a magic code will be sent to ${email}`
      : `a magic code has been sent to ${email}`
  }

  return (
    <StaticLayout>
      <div className='p-6 text-center'>
        {signin
          ? (
            <LoopVideo src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/coming-home.mp4`} width='480' height='270' />
            )
          : (
            <LoopVideo src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/signup-email.mp4`} width='640' height='302' />
            )}
        <h2 className='pt-6'>Check your email</h2>
        <h4 className='text-muted pt-2 pb-6'>{buildMessage()}</h4>
        <MagicCodeForm onSubmit={(token) => pushCallback(token)} disabled={!callback} signin={signin} />
      </div>
    </StaticLayout>
  )
}

export const MagicCodeForm = ({ onSubmit, disabled }) => {
  return (
    <Form
      initial={{
        token: ''
      }}
      schema={emailTokenSchema}
      onSubmit={(values) => {
        onSubmit(values.token)
      }}
    >
      <OtpInput
        length={6}
        name='token'
        required
        autoFocus
        groupClassName='flex flex-col justify-center gap-2'
        disabled={disabled}
      />
      <SubmitButton variant='primary' className='ps-6 pe-4' disabled={disabled}>enter <ArrowRightLineIcon height={20} width={20} className='ms-2' /></SubmitButton>
    </Form>
  )
}
