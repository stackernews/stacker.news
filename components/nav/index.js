import { useRouter } from 'next/router'
import DesktopHeader from './desktop/header'
import MobileHeader from './mobile/header'
import StickyBar from './sticky-bar'
import { CarouselProvider } from './carousel'

export default function Navigation ({ sub }) {
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const props = {
    prefix: sub ? `/~${sub}` : '',
    path,
    pathname: router.pathname,
    topNavKey: path.split('/')[sub ? 2 : 1] ?? '',
    dropNavKey: path.split('/').slice(sub ? 2 : 1).join('/'),
    sub
  }

  return (
    <CarouselProvider>
      <DesktopHeader {...props} />
      <MobileHeader {...props} />
      <StickyBar {...props} />
    </CarouselProvider>
  )
}
