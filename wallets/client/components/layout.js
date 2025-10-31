import { Alert } from 'react-bootstrap'
import Link from 'next/link'
import Layout from '@/components/layout'
import { useWalletImage } from '@/wallets/client/hooks'
import { walletDisplayName, walletGuideUrl, walletWarning } from '@/wallets/lib/util'
import InfoIcon from '@/svgs/information-fill.svg'
import Text from '@/components/text'

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

export function WalletLayoutImageOrName ({ name, maxHeight = '50px' }) {
  const img = useWalletImage(name)
  return (
    <div className='d-flex justify-content-center align-items-center text-center'>
      {img
        ? (
          <img
            src={img.src}
            alt={img.alt}
            style={{
              maxHeight,
              maxWidth: '100%'
            }}
          />
          )
        : walletDisplayName(name)}
    </div>
  )
}

export function WalletGuide ({ name }) {
  const guideUrl = walletGuideUrl(name)
  if (!guideUrl) return null

  return (
    <Link href={guideUrl} className='text-center text-reset fw-bold text-underline' target='_blank' rel='noreferrer'>
      <InfoIcon width={18} height={18} className='mx-1' />
      guide
    </Link>
  )
}

export function WalletLayoutWarning ({ name }) {
  const warning = walletWarning(name)
  if (!warning) return null

  if (warning) {
    return (
      <Alert variant='warning' className='mx-auto my-3'>
        <Text>{warning}</Text>
      </Alert>
    )
  }
}
