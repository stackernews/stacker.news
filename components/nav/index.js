import { useRouter } from 'next/router'
import DesktopHeader from './desktop/header'
import MobileHeader from './mobile/header'
import StickyBar from './sticky-bar'
import { PriceCarouselProvider } from './price-carousel'
import { useDomain } from '@/components/territory-domains'

export default function Navigation ({ sub }) {
  const router = useRouter()
  const { customDomain: { domain } } = useDomain()

  const path = router.asPath.split('?')[0]
  const props = {
    prefix: sub ? `/~${sub}` : '',
    path,
    pathname: router.pathname,
    topNavKey: domain
      ? path.split('/')[1] ?? ''
      : path.split('/')[sub ? 2 : 1] ?? '',
    dropNavKey: domain
      ? path.split('/').slice(1).join('/')
      : path.split('/').slice(sub ? 2 : 1).join('/'),
    domain,
    sub
  }

  return (
    <PriceCarouselProvider>
      <DesktopHeader {...props} />
      <MobileHeader {...props} />
      <StickyBar {...props} />
    </PriceCarouselProvider>
  )
}
