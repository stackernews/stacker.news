import Image from 'react-bootstrap/Image'
import { StaticLayout } from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback } from 'react'
import { Form, SubmitButton, MultiInput } from '@/components/form'
import { emailTokenSchema } from '@/lib/validate'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function Email () {
  const router = useRouter()
  const [callback, setCallback] = useState(null) // callback.email, callback.callbackUrl
  const [signin, setSignin] = useState(false)

  useEffect(() => {
    setSignin(document.cookie.includes('signin='))
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
      <div className='p-4 text-center'>
        <video width='640' height='302' loop autoPlay muted preload='auto' playsInline style={{ maxWidth: '100%' }}>
          <source src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/cowboy-saloon.mp4`} type='video/mp4' />
          <Image className='rounded-1 shadow-sm' width='640' height='302' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/cowboy-saloon.gif`} fluid />
        </video>
        <h2 className='pt-4'>Check your email</h2>
        <h4 className='text-muted pt-2 pb-4'>{buildMessage()}</h4>
        <MagicCodeForm onSubmit={(token) => pushCallback(token)} disabled={!callback} signin={signin} />
      </div>
    </StaticLayout>
  )
}

export const MagicCodeForm = ({ onSubmit, disabled, signin }) => {
  return (
    <Form
      initial={{
        token: ''
      }}
      schema={emailTokenSchema}
      onSubmit={(values) => {
        onSubmit(values.token.toLowerCase()) // token is displayed in uppercase but we need to check it in lowercase
      }}
    >
      <MultiInput
        length={6}
        charLength={1}
        name='token'
        required
        autoFocus
        groupClassName='d-flex flex-column justify-content-center gap-2'
        inputType='text'
        hideError // hide error message on every input, allow custom error message
        disabled={disabled} // disable the form if no callback is provided
      />
      <SubmitButton variant='primary' className='px-4' disabled={disabled}>{signin ? 'login' : 'signup'}</SubmitButton>
    </Form>
  )
}
