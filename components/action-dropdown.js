import Menu from '@/components/ui/menu'
import styles from './item.module.css'
import MoreIcon from '@/svgs/more-fill.svg'

export default function ActionDropdown ({ children }) {
  if (!children) {
    return null
  }
  return (
    <Menu className={`pointer ${styles.dropdown}`}>
      {/* the old anchor toggle had no href and was untabbable;
          nativeButton={false} decorates the span with role and tabIndex */}
      <Menu.Trigger nativeButton={false} render={<span><MoreIcon className='fill-grey ms-1' height={16} width={16} /></span>} />
      <Menu.Popup>{children}</Menu.Popup>
    </Menu>
  )
}
