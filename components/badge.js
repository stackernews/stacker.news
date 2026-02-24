import { Fragment } from 'react'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import CowboyHatIcon from '@/svgs/cowboy.svg'
import AnonIcon from '@/svgs/spy-fill.svg'
import GunIcon from '@/svgs/revolver.svg'
import HorseIcon from '@/svgs/horse.svg'
import BotIcon from '@/svgs/robot-2-fill.svg'
import { numWithUnits } from '@/lib/format'
import { USER_ID } from '@/lib/constants'
import classNames from 'classnames'

export default function Badges ({ user, badge, bot, showWalletBadges, className = 'ms-1', badgeClassName, spacingClassName = 'ms-1', height = 16, width = 16 }) {
  if (!user) return null
  if (Number(user.id) === USER_ID.anon) {
    return (
      <BadgeTooltip overlayText='anonymous'>
        <span className={className}><AnonIcon className={`${badgeClassName} align-middle`} height={height} width={width} /></span>
      </BadgeTooltip>
    )
  }

  let badges = []

  const streak = user.optional.streak
  if (streak !== null) {
    badges.push({
      icon: CowboyHatIcon,
      overlayText: streak
        ? `${numWithUnits(streak, { abbreviate: false, unitSingular: 'day', unitPlural: 'days' })}`
        : 'new'
    })
  }

  if (showWalletBadges && user.optional.hasRecvWallet) {
    badges.push({
      icon: HorseIcon,
      overlayText: 'can receive sats'
    })
  }

  if (showWalletBadges && user.optional.hasSendWallet) {
    badges.push({
      icon: GunIcon,
      sizeDelta: 2,
      style: { marginBottom: '-2px' },
      overlayText: 'can send sats'
    })
  }

  if (bot) {
    badges = [{
      icon: BotIcon,
      overlayText: 'posted as bot'
    }]
  }

  if (badges.length === 0) return null

  return (
    <span className={classNames(className, 'd-inline-flex align-items-center justify-content-center')}>
      {badges.map(({ icon, overlayText, sizeDelta, style }, i) => (
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
          style={style}
        />
      ))}
    </span>
  )
}

function SNBadge ({ user, badge, overlayText, badgeClassName, IconForBadge, height = 16, width = 16, sizeDelta = 0, style = {} }) {
  let Wrapper = Fragment

  if (overlayText) {
    Wrapper = ({ children }) => (
      <BadgeTooltip overlayText={overlayText}>{children}</BadgeTooltip>
    )
  }

  return (
    <Wrapper>
      <span className='d-inline-flex align-items-center justify-content-center' style={style}><IconForBadge className={badgeClassName} height={height + sizeDelta} width={width + sizeDelta} /></span>
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
