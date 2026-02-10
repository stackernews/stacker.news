import { useShowModal } from './modal'
import { useToast } from './toast'
import ItemAct from './item-act'
import AccordianItem from './accordian-item'
import { useMemo } from 'react'
import getColor from '@/lib/rainbow'
import BoostIcon from '@/svgs/arrow-up-double-line.svg'
import styles from './upvote.module.css'
import { BOOST_MIN } from '@/lib/constants'
import classNames from 'classnames'
import { useFeeButton } from './fee-button'
import { Input } from './form'
import Info from './info'
import { InputGroup } from 'react-bootstrap'
export default function Boost ({ item, className, ...props }) {
  const { boost } = item
  const [color, nextColor] = useMemo(() => [getColor(boost), getColor(boost + BOOST_MIN)], [boost])

  const style = useMemo(() => ({
    '--hover-fill': nextColor,
    '--hover-filter': `drop-shadow(0 0 6px ${nextColor}90)`,
    '--fill': color,
    '--filter': `drop-shadow(0 0 6px ${color}90)`
  }), [color, nextColor])

  return (
    <Booster
      item={item} As={oprops =>
        <div className='upvoteParent'>
          <div
            className={classNames(styles.upvoteWrapper, item.deletedAt && styles.noSelfTips)}
          >
            <BoostIcon
              {...props}
              {...oprops}
              style={style}
              width={26}
              height={26}
              className={classNames(styles.boost, className, boost && styles.boosted)}
            />
          </div>
        </div>}
    />
  )
}

export function BoostHelp () {
  return (
    <ol>
      <li>Boost is <strong>exactly</strong> like a zap from other stackers: it ranks the item higher based on the amount</li>
      <li>100% of boost goes to the territory founder and top stackers as rewards</li>
      <li>Boosted items can be downzapped to reduce their rank</li>
    </ol>
  )
}

export function BoostInput ({ onChange, ...props }) {
  const feeButton = useFeeButton()
  let merge
  if (feeButton) {
    ({ merge } = feeButton)
  }
  return (
    <Input
      label={
        <div className='d-flex align-items-center'>boost
          <Info>
            <BoostHelp />
          </Info>
        </div>
    }
      name='boost'
      onChange={(_, e) => {
        merge?.({
          boost: {
            term: `+ ${e.target.value}`,
            label: 'boost',
            op: '+',
            modifier: cost => cost + Number(e.target.value)
          }
        })
        onChange && onChange(_, e)
      }}
      hint={<span className='text-muted'>ranks items higher based on the amount</span>}
      append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      {...props}
    />
  )
}

function Booster ({ item, As, children }) {
  const toaster = useToast()
  const showModal = useShowModal()

  return (
    <As
      onClick={async () => {
        try {
          showModal(onClose =>
            <ItemAct onClose={onClose} item={item} act='BOOST' step={BOOST_MIN}>
              <AccordianItem header='what is boost?' body={<BoostHelp />} />
            </ItemAct>)
        } catch (error) {
          toaster.danger('failed to boost item')
        }
      }}
    >
      {children}
    </As>
  )
}
