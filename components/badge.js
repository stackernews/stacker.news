import { Fragment } from 'react'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import CowboyHatIcon from '@/svgs/cowboy.svg'
import AnonIcon from '@/svgs/spy-fill.svg'
import GunIcon from '@/svgs/revolver.svg'
import HorseIcon from '@/svgs/horse.svg'
import { numWithUnits } from '@/lib/format'
import { USER_ID } from '@/lib/constants'
import classNames from 'classnames'

export default function Badges ({ user, badge, className = 'ms-1', badgeClassName, spacingClassName = 'ms-1', height = 16, width = 16 }) {
  if (!user || Number(user.id) === USER_ID.ad) return null
  if (Number(user.id) === USER_ID.anon) {
    return (
      <BadgeTooltip overlayText='anonymous'>
        <span className={className}><AnonIcon className={`${badgeClassName} align-middle`} height={height} width={width} /></span>
      </BadgeTooltip>
    )
  }

  const badges = []

  const streak = user.optional.streak
  if (streak !== null) {
    badges.push({
      icon: CowboyHatIcon,
      overlayText: streak
        ? `${numWithUnits(streak, { abbreviate: false, unitSingular: 'day', unitPlural: 'days' })}`
        : 'new'
    })
  }

  if (user.optional.hasRecvWallet) {
    badges.push({
      icon: HorseIcon,
      overlayText: 'can receive bitcoins'
    })
  }

  if (user.optional.hasSendWallet) {
    badges.push({
      icon: GunIcon,
      sizeDelta: 2,
      overlayText: 'can send bitcoins'
    })
  }

  return (
    <span className={className}>
      {badges.map(({ icon, overlayText, sizeDelta }, i) => (
        <SNBadge
          key={i}
          user={user}
          badge={badge}
          overlayText={overlayText}
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

function SNBadge ({ user, badge, overlayText, badgeClassName, IconForBadge, height = 16, width = 16, sizeDelta = 0 }) {
  let Wrapper = Fragment

  if (overlayText) {
    Wrapper = ({ children }) => (
      <BadgeTooltip overlayText={overlayText}>{children}</BadgeTooltip>
    )
  }

  return (
    <Wrapper>
      <span><IconForBadge className={badgeClassName} height={height + sizeDelta} width={width + sizeDelta} /></span>
    </Wrapper>
  )
}

export function BadgeTooltip ({ children, overlayText, placement }) {
  return (
    <OverlayTrigger
      placement={placement || 'bottom'}
      overlay={
        <Tooltip style={{ position: 'fixed' }}>
          {overlayText}
        </Tooltip>
      }
      trigger={['hover', 'focus']}
    >
      {children}
    </OverlayTrigger>
  )
}
