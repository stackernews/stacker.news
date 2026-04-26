import { useRouter } from 'next/router'
import DesktopHeader from './desktop/header'
import MobileHeader from './mobile/header'
import StickyBar from './sticky-bar'
import { PriceCarouselProvider } from './price-carousel'
import { usePrefix, useNavKeys } from '../territory-domains'

export default function Navigation ({ sub }) {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const prefix = usePrefix(sub)
  const { topNavKey, dropNavKey } = useNavKeys(path, sub)
  const props = {
    prefix,
    path,
    pathname: router.pathname,
    topNavKey,
    dropNavKey,
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
