import Container from '@/components/ui/container'
import TopBar from './top-bar'
import SecondBar from './second-bar'
import { hasNavSelect } from '../common'

export default function Header (props) {
  // Stacked bars split the vertical padding between them.
  const second = hasNavSelect(props)
  return (
    <div data-sn-navigation className='hidden md:block'>
      <Container as='header'>
        <TopBar {...props} navbarClassName={second ? 'pt-2 pb-0' : 'py-2'} />
        <SecondBar {...props} navbarClassName='pt-0 pb-2' />
      </Container>
    </div>
  )
}
