import { Menu, MenuTrigger, MenuPopup } from '@/components/ui/menu'
import styles from './item.module.css'
import MoreIcon from '@/svgs/more-fill.svg'

export default function ActionDropdown ({ children }) {
  if (!children) {
    return null
  }
  return (
    <Menu className={`pointer ${styles.dropdown}`}>
      {/* Base UI gives the rendered span button semantics. */}
      <MenuTrigger aria-label='Item actions' nativeButton={false} render={<span><MoreIcon className='fill-grey ms-1' height={16} width={16} /></span>} />
      <MenuPopup>{children}</MenuPopup>
    </Menu>
  )
}
