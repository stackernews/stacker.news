import { Container } from 'react-bootstrap'
import TopBar from './top-bar'
import NavSelectBar from './navselect-bar'

export default function Header (props) {
  return (
    <div className='d-block d-md-none'>
      <Container as='header' className='px-sm-0'>
        <NavSelectBar {...props} />
        <TopBar {...props} />
      </Container>
    </div>
  )
}
