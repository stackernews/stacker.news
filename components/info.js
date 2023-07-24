import InfoIcon from '../svgs/information-fill.svg'
import { useShowModal } from './modal'

export default function Info ({ children, iconClassName = 'fill-theme-color' }) {
  const showModal = useShowModal()

  return (
    <InfoIcon
      width={18} height={18} className={`${iconClassName} pointer ms-1`}
      onClick={(e) => {
        e.preventDefault()
        showModal(onClose => children)
      }}
    />
  )
}
