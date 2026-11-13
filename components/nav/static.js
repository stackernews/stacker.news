import { Nav, Navbar, NavLink } from '@/components/ui/nav'
import Container from '@/components/ui/container'
import styles from '../header.module.css'
import { Back, Brand } from './common'
import SearchIcon from '@/svgs/search-line.svg'
import { SEARCH_PATH } from '@/lib/search'

export default function StaticHeader () {
  return (
    <Container as='header' data-sn-navigation>
      <Navbar>
        <Nav className={styles.navbarNav}>
          <Brand className='hidden md:block' />
          <div className='md:hidden'>
            <Back fallback={<Brand />} />
          </div>
          <NavLink href={SEARCH_PATH} eventKey='search'>
            <SearchIcon width={22} height={28} />
          </NavLink>
        </Nav>
      </Navbar>
    </Container>
  )
}
