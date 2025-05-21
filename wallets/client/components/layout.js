import Layout from '@/components/layout'
import { useWalletImage } from '@/wallets/client/hooks'
import { walletDisplayName } from '@/wallets/client/util'
import Link from 'next/link'

export function WalletLayout ({ children }) {
  // TODO(wallet-v2): py-5 doesn't work, I think it gets overriden by the layout class
  // so I still need to add it manually to the first child ...
  return (
    <Layout className='py-5' footer={false}>
      {children}
    </Layout>
  )
}

export function WalletLayoutHeader ({ children }) {
  return (
    <h2 className='mb-2 text-center'>
      {children}
    </h2>
  )
}

export function WalletLayoutSubHeader ({ children }) {
  return (
    <h6 className='text-muted text-center'>
      {children}
    </h6>
  )
}

export function WalletLayoutLink ({ children, href }) {
  return (
    <Link href={href} className='text-muted fw-bold text-underline'>
      {children}
    </Link>
  )
}

export function WalletLayoutImageOrName ({ name }) {
  const walletNameToImage = useWalletImage()
  const img = walletNameToImage(name)
  return (
    <div className='d-flex justify-content-center align-items-center text-center'>
      {img
        ? (
          <img
            src={img.src}
            alt={img.alt}
            style={{
              maxHeight: '50px',
              maxWidth: '100%'
            }}
          />
          )
        : walletDisplayName(name)}
    </div>
  )
}
