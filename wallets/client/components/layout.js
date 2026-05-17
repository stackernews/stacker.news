import Layout from '@/components/layout'
import { Back, Brand, NavNotifications, NavPrice } from '@/components/nav/common'
import { PriceCarouselProvider } from '@/components/nav/price-carousel'
import { useWalletImage } from '@/wallets/client/hooks'
import { walletDisplayName, walletGuideUrl } from '@/wallets/lib/util'
import Link from 'next/link'
import InfoIcon from '@/svgs/information-fill.svg'
import styles from '@/styles/wallet.module.css'
import classNames from 'classnames'
import { useEffect, useState } from 'react'

export function WalletLayout ({ children, standalone = false }) {
  // TODO(wallet-v2): py-5 doesn't work, I think it gets overriden by the layout class
  // so I still need to add it manually to the first child ...
  return (
    <Layout className='py-5' contain={!standalone} containClassName={styles.walletContain} footer={false} hideMobileNav hideNav={standalone}>
      {standalone ? <main className={styles.walletStandaloneContain}>{children}</main> : children}
    </Layout>
  )
}

export function WalletShell ({ children, mobileHeader, noSidebar }) {
  return (
    <WalletLayout>
      <div className={classNames(styles.walletShell, noSidebar && styles.walletShellNoSidebar)}>
        <div className={styles.mobileWalletHeader}>
          <WalletMobileTopBar />
          {mobileHeader}
        </div>
        {children}
      </div>
    </WalletLayout>
  )
}

export function WalletMobileTopBar () {
  return (
    <PriceCarouselProvider>
      <div className={styles.walletMobileTopBar}>
        <div className={styles.walletBackBrandNav}>
          <Back />
          <Brand />
        </div>
        <NavPrice className={styles.walletMobilePrice} />
        <div className={styles.walletMobileAccount}>
          <NavNotifications className={styles.walletMobileRightCorner} />
        </div>
      </div>
    </PriceCarouselProvider>
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
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [img?.src])

  return (
    <div className='d-flex justify-content-center align-items-center text-center'>
      {img && !imageError
        ? (
          <img
            src={img.src}
            alt={img.alt}
            onError={() => setImageError(true)}
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
