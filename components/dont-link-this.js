import Dropdown from 'react-bootstrap/Dropdown'
import { useShowModal } from './modal'
import { useToast } from './toast'
import ItemAct from './item-act'
import AccordianItem from './accordian-item'
import Flag from '@/svgs/flag-fill.svg'
import { useCallback, useMemo } from 'react'
import getColor from '@/lib/rainbow'
import { gql, useMutation } from '@apollo/client'
import { useItemContext } from './item'

export function DownZap ({ item, ...props }) {
  const { pendingDownSats } = useItemContext()
  const { meDontLikeSats } = item

  const downSats = meDontLikeSats + pendingDownSats

  const style = useMemo(() => (downSats
    ? {
        fill: getColor(downSats),
        filter: `drop-shadow(0 0 6px ${getColor(downSats)}90)`
      }
    : undefined), [downSats])
  return (
    <DownZapper item={item} As={({ ...oprops }) => <Flag {...props} {...oprops} style={style} />} />
  )
}

function DownZapper ({ item, As, children }) {
  const toaster = useToast()
  const showModal = useShowModal()
  const { setPendingDownSats } = useItemContext()

  const optimisticUpdate = useCallback((sats, { onClose } = {}) => {
    setPendingDownSats(pendingSats => pendingSats + sats)
    onClose?.()
    return () => {
      setPendingDownSats(pendingSats => pendingSats - sats)
    }
  }, [])

  return (
    <As
      onClick={async () => {
        try {
          showModal(onClose =>
            <ItemAct
              onClose={onClose} item={item} down optimisticUpdate={optimisticUpdate}
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

export default function DontLikeThisDropdownItem ({ item }) {
  return (
    <DownZapper
      As={Dropdown.Item}
      item={item}
    >
      <span className='text-danger'>downzap</span>
    </DownZapper>
  )
}

export function OutlawDropdownItem ({ item }) {
  const toaster = useToast()

  const [toggleOutlaw] = useMutation(
    gql`
      mutation toggleOutlaw($id: ID!) {
        toggleOutlaw(id: $id) {
          outlawed
        }
      }`, {
      update (cache, { data: { toggleOutlaw } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            outlawed: () => true
          }
        })
      }
    }
  )

  return (
    <Dropdown.Item onClick={async () => {
      try {
        await toggleOutlaw({ variables: { id: item.id } })
      } catch {
        toaster.danger('failed to outlaw')
        return
      }

      toaster.success('item outlawed')
    }}
    >
      outlaw
    </Dropdown.Item>
  )
}
