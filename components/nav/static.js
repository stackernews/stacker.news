import { Nav, Navbar } from '@/components/ui/nav'
import Container from '@/components/ui/container'
import styles from '../header.module.css'
import { BackOrBrand, NavPrice, SearchItem } from './common'
import { PriceCarouselProvider } from './price-carousel'

export default function StaticHeader () {
  return (
    <PriceCarouselProvider>
      <Container as='header' data-sn-navigation>
        <Navbar className='py-2'>
          <Nav className={styles.navbarNav}>
            <BackOrBrand />
            <SearchItem />
            <NavPrice className='justify-end' />
          </Nav>
        </Navbar>
      </Container>
    </PriceCarouselProvider>
  )
}
