import { Nav, Navbar } from '@/components/ui/nav'
import Container from '@/components/ui/container'
import styles from '../header.module.css'
import { BackOrBrand, Brand, SearchItem } from './common'

export default function StaticHeader () {
  return (
    <Container as='header' data-sn-navigation>
      <Navbar>
        <Nav className={styles.navbarNav}>
          <Brand className='hidden md:block' />
          <div className='md:hidden'>
            <BackOrBrand />
          </div>
          <SearchItem />
        </Nav>
      </Navbar>
    </Container>
  )
}
