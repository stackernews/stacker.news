import Layout from '@/components/layout'
import { Back, Brand, NavNotifications, NavPrice } from '@/components/nav/common'
import { PriceCarouselProvider } from '@/components/nav/price-carousel'
import { walletGuideUrl } from '@/wallets/lib/util'
import { WalletLogo } from './wallet-logo'
import Link from 'next/link'
import InfoIcon from '@/svgs/information-fill.svg'
import styles from '@/wallets/client/components/layout.module.css'
import classNames from 'classnames'

export function WalletShell ({ children, mobileHeader, noSidebar, mobileTopBar = true }) {
  return (
    // Wallet pages replace the global mobile footer with app-like wallet chrome.
    <Layout className='py-5' containClassName={classNames(styles.walletContain, 'pb-0')} footer={false} hideMobileNav>
      <div className={classNames(styles.walletShell, noSidebar && styles.walletShellNoSidebar)}>
        {(mobileTopBar || mobileHeader) && (
          <div className={styles.mobileWalletHeader}>
            {mobileTopBar && <WalletMobileTopBar />}
            {mobileHeader}
          </div>
        )}
        {children}
      </div>
    </Layout>
  )
}

function WalletMobileTopBar () {
  return (
    <PriceCarouselProvider>
      <div className={styles.walletMobileTopBar}>
        <div className='d-inline-flex align-items-center w-fit-content'>
          <Back />
          <Brand />
        </div>
        <NavPrice className='justify-self-center' />
        <div className={classNames(styles.walletMobileAccount, 'd-flex align-items-center justify-content-end gap-2')}>
          <NavNotifications className='d-flex align-items-center justify-content-end p-0' />
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

function WalletLayoutImageOrName ({ name, height = '50px' }) {
  return (
    <div className='d-flex justify-content-center align-items-center text-center'>
      <WalletLogo name={name} fallback='name' height={height} />
    </div>
  )
}

function WalletDetailHeader ({ wallet, title }) {
  return (
    <header className={styles.walletPageHeading}>
      <h1>{title}</h1>
      <div className={classNames(styles.walletActionWallet, 'd-inline-flex align-items-center text-muted fw-bold')}>
        <WalletLayoutImageOrName name={wallet.name} height='24px' />
      </div>
    </header>
  )
}

export function WalletShellMain ({ children, mobileTopBar }) {
  return (
    <WalletShell noSidebar mobileTopBar={mobileTopBar}>
      <main className={styles.walletMain}>
        {children}
      </main>
    </WalletShell>
  )
}

export function WalletDetailPage ({ wallet, title, children }) {
  return (
    <WalletShellMain>
      <div className={styles.walletDetailPage}>
        {title && <WalletDetailHeader wallet={wallet} title={title} />}
        {children}
      </div>
    </WalletShellMain>
  )
}

export function WalletActionShell ({ wallet, title, identity, available, children }) {
  return (
    <WalletShellMain>
      <div className={styles.walletActionPage}>
        <div className={classNames(styles.walletActionBody, 'd-flex flex-column')}>
          <div className={styles.walletPageHeading}>
            <h1>{title}</h1>
            <div className={styles.walletActionWalletRow}>
              <div className={classNames(styles.walletActionWallet, 'd-inline-flex align-items-center text-muted fw-bold')}>
                {identity ?? <WalletLayoutImageOrName name={wallet.name} height='24px' />}
              </div>
              {available && (
                <div className={classNames(styles.walletActionAvailable, 'text-end')}>
                  <div className={styles.walletActionAvailableAmount}>{available.amount}</div>
                  <div className={classNames(styles.walletActionAvailableLabel, 'text-muted')}>{available.label ?? 'available'}</div>
                </div>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </WalletShellMain>
  )
}

export function WalletActionEmpty ({ message, backHref, backLabel = 'back to wallet' }) {
  return (
    <div className='d-flex flex-column align-items-center justify-content-center gap-4 flex-fill fs-4 text-center text-muted'>
      <div>{message}</div>
      {backHref && (
        <Link href={backHref} className='btn btn-secondary'>
          {backLabel}
        </Link>
      )}
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
