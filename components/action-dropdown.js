import Dropdown from 'react-bootstrap/Dropdown'
import styles from './item.module.css'
import MoreIcon from '../svgs/more-fill.svg'

export default function ActionDropdown ({ children }) {
  if (!children) {
    return null
  }
  return (
    <Dropdown className={`pointer ${styles.dropdown}`} as='span'>
      <Dropdown.Toggle variant='success' as='a' onPointerDown={e => e.preventDefault()}>
        <MoreIcon className='fill-grey ms-1' height={16} width={16} />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {children}
      </Dropdown.Menu>
    </Dropdown>
  )
}
