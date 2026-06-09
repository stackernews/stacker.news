import { Container, Nav, Navbar } from 'react-bootstrap'
import styles from '../header.module.css'
import { BackOrBrand, NavPrice, SearchItem } from './common'
import { PriceCarouselProvider } from './price-carousel'

export default function StaticHeader () {
  return (
    <PriceCarouselProvider>
      <Container as='header' className='px-sm-0'>
        <Navbar>
          <Nav
            className={styles.navbarNav}
          >
            <BackOrBrand />
            <SearchItem />
            <NavPrice className='justify-content-end' />
          </Nav>
        </Navbar>
      </Container>
    </PriceCarouselProvider>
  )
}
