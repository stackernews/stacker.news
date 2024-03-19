import Image from 'react-bootstrap/Image'
import { StaticLayout } from '@/components/layout'
import { getGetServerSideProps } from '@/api/ssrApollo'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function Email () {
  return (
    <StaticLayout>
      <div className='p-4 text-center'>
        <video width='640' height='302' loop autoPlay muted preload='auto' playsInline style={{ maxWidth: '100%' }}>
          <source src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/cowboy-saloon.mp4`} type='video/mp4' />
          <Image className='rounded-1 shadow-sm' width='640' height='302' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/cowboy-saloon.gif`} fluid />
        </video>
        <h2 className='pt-4'>Check your email</h2>
        <h4 className='text-muted pt-2'>A sign in link has been sent to your email address</h4>
      </div>
    </StaticLayout>
  )
}
