import Nav from '@/components/ui/nav'
import Container from '@/components/ui/container'
import styles from '../header.module.css'
import { BackOrBrand, NavPrice, SearchItem } from './common'
import { PriceCarouselProvider } from './price-carousel'

// Static navigation has no active destination.
export default function StaticHeader () {
  return (
    <PriceCarouselProvider>
      <Container as='header'>
        <nav className='flex items-center flex-nowrap py-2'>
          <Nav className={styles.navbarNav}>
            <BackOrBrand />
            <SearchItem />
            <NavPrice className='justify-end' />
          </Nav>
        </nav>
      </Container>
    </PriceCarouselProvider>
  )
}
