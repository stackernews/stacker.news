import Container from '@/components/ui/container'
import TopBar from './top-bar'
import SecondBar from './second-bar'

export default function Header (props) {
  return (
    <div className='block md:hidden'>
      <Container as='header' className='sm:px-0'>
        <TopBar {...props} />
        <SecondBar {...props} />
      </Container>
    </div>
  )
}
