import Badge from 'react-bootstrap/Badge'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import CowboyHatIcon from '@/svgs/cowboy.svg'
import AnonIcon from '@/svgs/spy-fill.svg'
import { numWithUnits } from '@/lib/format'
import { USER_ID } from '@/lib/constants'
import GunIcon from '@/svgs/revolver.svg'
import HorseIcon from '@/svgs/horse.svg'
import classNames from 'classnames'

const BADGES = [
  {
    icon: CowboyHatIcon,
    streakName: 'streak'
  },
  {
    icon: HorseIcon,
    streakName: 'horseStreak'
  },
  {
    icon: GunIcon,
    streakName: 'gunStreak',
    sizeDelta: 2
  }
]

export default function Badges ({ user, badge, className = 'ms-1', badgeClassName, spacingClassName = 'ms-1', height = 16, width = 16 }) {
  if (!user || Number(user.id) === USER_ID.ad) return null
  if (Number(user.id) === USER_ID.anon) {
    return (
      <BadgeTooltip overlayText='anonymous'>
        {badge
          ? (
            <Badge bg='grey-medium' className='ms-2 d-inline-flex align-items-center'>
              <AnonIcon className={`${badgeClassName} fill-dark align-middle`} height={height} width={width} />
            </Badge>)
          : <span><AnonIcon className={`${badgeClassName} align-middle`} height={height} width={width} /></span>}
      </BadgeTooltip>
    )
  }

  return (
    <span className={className}>
      {BADGES.map(({ icon, streakName, sizeDelta }, i) => (
        <SNBadge
          key={streakName}
          user={user}
          badge={badge}
          streakName={streakName}
          badgeClassName={classNames(badgeClassName, i > 0 && spacingClassName)}
          IconForBadge={icon}
          height={height}
          width={width}
          sizeDelta={sizeDelta}
        />
      ))}
    </span>
  )
}

function SNBadge ({ user, badge, streakName, badgeClassName, IconForBadge, height = 16, width = 16, sizeDelta = 0 }) {
  const streak = user.optional[streakName]
  if (streak === null) {
    return null
  }

  return (
    <BadgeTooltip
      overlayText={streak
        ? `${numWithUnits(streak, { abbreviate: false, unitSingular: 'day', unitPlural: 'days' })}`
        : 'new'}
    >
      <span><IconForBadge className={badgeClassName} height={height + sizeDelta} width={width + sizeDelta} /></span>
    </BadgeTooltip>
  )
}

export function BadgeTooltip ({ children, overlayText, placement }) {
  return (
    <OverlayTrigger
      placement={placement || 'bottom'}
      overlay={
        <Tooltip>
          {overlayText}
        </Tooltip>
      }
      trigger={['hover', 'focus']}
    >
      {children}
    </OverlayTrigger>
  )
}
