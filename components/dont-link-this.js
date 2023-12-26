import Dropdown from 'react-bootstrap/Dropdown'
import { useShowModal } from './modal'
import { useToast } from './toast'
import ItemAct from './item-act'
import AccordianItem from './accordian-item'
import Flag from '../svgs/flag-fill.svg'
import { useMemo } from 'react'
import getColor from '../lib/rainbow'
import { useLightning } from './lightning'

export function DownZap ({ id, meDontLikeSats, ...props }) {
  const style = useMemo(() => (meDontLikeSats
    ? {
        fill: getColor(meDontLikeSats),
        filter: `drop-shadow(0 0 6px ${getColor(meDontLikeSats)}90)`
      }
    : undefined), [meDontLikeSats])
  return (
    <DownZapper id={id} As={({ ...oprops }) => <Flag {...props} {...oprops} style={style} />} />
  )
}

function DownZapper ({ id, As, children }) {
  const toaster = useToast()
  const showModal = useShowModal()
  const strike = useLightning()

  return (
    <As
      onClick={async () => {
        try {
          showModal(onClose =>
            <ItemAct
              onClose={() => {
                onClose()
                toaster.success('item downzapped')
              }} itemId={id} strike={strike} down
            >
              <AccordianItem
                header='what is a downzap?' body={
                  <ul>
                    <li>downzaps are just like zaps but cause items to lose ranking position</li>
                    <li>downzaps also reduce trust between you and whoever zaps it so you'll see less of what they zap in the future</li>
                    <li>all sats from downzaps go to rewards</li>
                  </ul>
              }
              />
            </ItemAct>)
        } catch (error) {
          toaster.danger('failed to downzap item')
        }
      }}
    >
      {children}
    </As>
  )
}

export default function DontLikeThisDropdownItem ({ id }) {
  return (
    <DownZapper
      As={Dropdown.Item}
      id={id}
    >
      <span className='text-danger'>downzap</span>
    </DownZapper>
  )
}
