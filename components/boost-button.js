import { useShowModal } from './modal'
import { useToast } from './toast'
import ItemAct from './item-act'
import AccordianItem from './accordian-item'
import { useMemo } from 'react'
import getColor from '@/lib/rainbow'
import BoostIcon from '@/svgs/arrow-up-double-line.svg'
import styles from './upvote.module.css'
import { BoostHelp } from './adv-post-form'
import { BOOST_MULT } from '@/lib/constants'
import classNames from 'classnames'

export default function Boost ({ item, className, ...props }) {
  const { boost } = item
  const [color, nextColor] = useMemo(() => [getColor(boost), getColor(boost + BOOST_MULT)], [boost])

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

function Booster ({ item, As, children }) {
  const toaster = useToast()
  const showModal = useShowModal()

  return (
    <As
      onClick={async () => {
        try {
          showModal(onClose =>
            <ItemAct onClose={onClose} item={item} act='BOOST' step={BOOST_MULT}>
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
