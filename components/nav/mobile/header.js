import { Container } from 'react-bootstrap'
import TopBar from './top-bar'
import SecondBar from './second-bar'
import { hasNavSelect } from '../common'

export default function Header (props) {
  const { path, pathname } = props
  return (
    <div className='d-block d-md-none'>
      <Container as='header' className='px-sm-0'>
        {!hasNavSelect({ path, pathname }) && <TopBar {...props} />}
        <SecondBar {...props} />
      </Container>
    </div>
  )
}
