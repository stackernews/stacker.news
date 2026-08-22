import Container from '@/components/ui/container'
import TopBar from './top-bar'
import SecondBar from './second-bar'
import { hasNavSelect } from '../common'
import { useBranding } from '@/components/territory-branding'

export default function Header (props) {
  const branding = useBranding()
  const navSelect = hasNavSelect(props)
  // A single bar keeps both paddings. Stacked bars split them, while branded
  // domains can render the second bar by itself.
  return (
    <div data-sn-navigation className='block md:hidden'>
      <Container as='header'>
        <TopBar {...props} navbarClassName={navSelect ? 'pt-2 pb-0' : 'py-2'} />
        <SecondBar {...props} navbarClassName={branding && navSelect ? 'py-2' : 'pt-0 pb-2'} />
      </Container>
    </div>
  )
}
