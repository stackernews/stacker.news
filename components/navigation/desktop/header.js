import { Container } from 'react-bootstrap'
import TopBar from './top-bar'
import SecondBar from './second-bar'

export default function Header (props) {
  return (
    <div className='d-none d-md-block'>
      <Container as='header' className='px-0'>
        <TopBar {...props} />
        <SecondBar {...props} />
      </Container>
    </div>
  )
}
