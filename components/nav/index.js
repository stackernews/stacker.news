import { useRouter } from 'next/router'
import DesktopHeader from './desktop/header'
import MobileHeader from './mobile/header'
import StickyBar from './sticky-bar'
import { PriceCarouselProvider } from './price-carousel'
import { useDomain } from '@/components/territory-domains'

export default function Navigation ({ sub }) {
  const router = useRouter()
  const { isCustomDomain } = useDomain()

  const path = router.asPath.split('?')[0]
  const props = {
    prefix: sub ? `/~${sub}` : '',
    path,
    pathname: router.pathname,
    topNavKey: isCustomDomain
      ? path.split('/')[1] ?? ''
      : path.split('/')[sub ? 2 : 1] ?? '',
    dropNavKey: isCustomDomain
      ? path.split('/').slice(1).join('/')
      : path.split('/').slice(sub ? 2 : 1).join('/'),
    isCustomDomain,
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
