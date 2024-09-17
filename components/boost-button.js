import { useShowModal } from './modal'
import { useToast } from './toast'
import ItemAct from './item-act'
import AccordianItem from './accordian-item'
import { useMemo } from 'react'
import getColor from '@/lib/rainbow'
import UpBolt from '@/svgs/bolt.svg'
import styles from './upvote.module.css'
import { BoostHelp } from './adv-post-form'
import { BOOST_MULT } from '@/lib/constants'
import classNames from 'classnames'

export default function Boost ({ item, className, ...props }) {
  const { boost } = item
  const style = useMemo(() => (boost
    ? {
        fill: getColor(boost),
        filter: `drop-shadow(0 0 6px ${getColor(boost)}90)`,
        transform: 'scaleX(-1)'
      }
    : {
        transform: 'scaleX(-1)'
      }), [boost])
  return (
    <Booster
      item={item} As={({ ...oprops }) =>
        <div
          className={styles.upvoteWrapper}
        >
          <UpBolt
            {...props} {...oprops} style={style}
            className={classNames(styles.upvote, className, boost && styles.voted)}
          />
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
