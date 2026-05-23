/* global Path2D */
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { randInRange } from '@/lib/rand'
import styles from './thunderstorm.module.css'

const FOG = {
  light: {
    '--thunderstorm-fog-height': '110px',
    '--thunderstorm-fog-opacity': 0.35,
    '--thunderstorm-fog-blur': '12px',
    '--thunderstorm-fog-drift': '42s'
  },
  medium: {
    '--thunderstorm-fog-height': '170px',
    '--thunderstorm-fog-opacity': 0.55,
    '--thunderstorm-fog-blur': '18px',
    '--thunderstorm-fog-drift': '34s'
  },
  heavy: {
    '--thunderstorm-fog-height': '250px',
    '--thunderstorm-fog-opacity': 0.78,
    '--thunderstorm-fog-blur': '26px',
    '--thunderstorm-fog-drift': '26s'
  }
}

const INTENSITY = {
  strike: {
    cloudGap: null,
    cloudSize: null,
    strikeChance: 0,
    wind: 0
  },
  light: {
    cloudGap: [44, 70],
    cloudSize: [24, 54],
    strikeChance: 0.00006,
    wind: 0.12
  },
  normal: {
    cloudGap: [30, 54],
    cloudSize: [32, 72],
    strikeChance: 0.00014,
    wind: 0.18
  },
  heavy: {
    cloudGap: [20, 42],
    cloudSize: [42, 92],
    strikeChance: 0.00026,
    wind: 0.26
  },
  extreme: {
    cloudGap: [12, 30],
    cloudSize: [58, 120],
    strikeChance: 0.0006,
    wind: 0.36
  }
}

const BOLT_STORM = {
  speed: 145,
  spread: 28,
  growthRate: 480,
  childGrowthRate: 180,
  fadeDuration: 0.133,
  speedDecay: 18,
  spreadDecay: 4,
  childMaxBranches: 2
}

const BOLT_STRIKE = {
  speed: 100,
  spread: 30,
  growthRate: 60,
  childGrowthRate: 60,
  fadeDuration: 1.25,
  speedDecay: 2,
  spreadDecay: 2,
  childMaxBranches: 10
}

function Thunderstorm ({
  active = true,
  intensity = 'normal',
  fog: fogLevel = 'medium',
  duration,
  clearDuration = 2500,
  onDone,
  className,
  style
}) {
  const canvasRef = useRef(null)
  const clearingRef = useRef(false)
  const isStrike = intensity === 'strike'
  const fog = isStrike ? null : fogLevel
  const fogStyle = useMemo(() => fog ? FOG[fog] || FOG.medium : {}, [fog])

  // adjust state when `active` prop changes (render-time derivation)
  const [prevActive, setPrevActive] = useState(active)
  const [showing, setShowing] = useState(active)
  const [clearing, setClearing] = useState(false)
  if (active !== prevActive) {
    setPrevActive(active)
    setShowing(active)
    setClearing(false)
    clearingRef.current = false
  }

  useEffect(() => {
    if (!active || !Number.isFinite(duration) || duration <= 0) return

    const exitDuration = Number.isFinite(clearDuration) && clearDuration > 0 ? clearDuration : 0
    const clearTimer = setTimeout(() => {
      if (exitDuration > 0) {
        clearingRef.current = true
        setClearing(true)
      } else {
        setShowing(false)
      }
    }, duration)
    const removeTimer = setTimeout(() => setShowing(false), duration + exitDuration)

    return () => {
      clearTimeout(clearTimer)
      clearTimeout(removeTimer)
    }
  }, [active, duration, clearDuration])

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (!showing) {
      onDoneRef.current?.()
    }
  }, [showing])

  useEffect(() => {
    if (!active || !showing) return

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const settings = INTENSITY[intensity] || INTENSITY.normal
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame
    let resizeFrame
    let clouds = []
    let bolts = []
    let lastTime = performance.now()

    const resize = () => {
      const pixelRatio = window.devicePixelRatio || 1
      canvas.width = Math.floor(window.innerWidth * pixelRatio)
      canvas.height = Math.floor(window.innerHeight * pixelRatio)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      clouds = isStrike ? [] : makeClouds(settings)
      bolts = []
      drawFrame(context, clouds, bolts, isStrike)
    }

    const onResize = () => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(resize)
    }

    const spawnCloudBolt = (cloud) => {
      const startPoint = [cloud.x, 0]
      const remainingHeight = window.innerHeight - startPoint[1]
      bolts.push(new StormBolt({
        ...BOLT_STORM,
        startPoint,
        length: randInRange(remainingHeight * 0.9, remainingHeight * 1.35),
        flash: true
      }))
    }

    // strikeChance is tuned for 60fps; scale by deltaTime so behavior
    // is consistent across refresh rates
    const strikeChancePerSecond = settings.strikeChance * 60

    const animate = (now) => {
      const deltaTime = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      clouds.forEach(cloud => {
        cloud.x += cloud.speed * deltaTime * 60
        if (cloud.x > window.innerWidth + cloud.radius) {
          cloud.x = -cloud.radius
        } else if (cloud.x < -cloud.radius) {
          cloud.x = window.innerWidth + cloud.radius
        }

        if (!clearingRef.current && Math.random() < strikeChancePerSecond * deltaTime) {
          spawnCloudBolt(cloud)
        }
      })

      if (isStrike && bolts.length === 0 && !clearingRef.current) {
        const x = Math.random() * (window.innerWidth * 0.5) + (window.innerWidth * 0.25)
        bolts.push(new StormBolt({
          ...BOLT_STRIKE,
          startPoint: [x, 0],
          length: window.innerHeight,
          flash: false
        }))
      }

      bolts.forEach(bolt => bolt.step(deltaTime))
      bolts = bolts.filter(bolt => !bolt.isTreeDone())

      drawFrame(context, clouds, bolts, isStrike)

      if (isStrike && bolts.length === 0) {
        setShowing(false)
        return
      }

      animationFrame = window.requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener('resize', onResize)

    if (!isStrike && clouds.length > 0) {
      spawnCloudBolt(clouds[Math.floor(Math.random() * clouds.length)])
    }

    let dismissTimer
    if (!reduceMotion.matches) {
      animationFrame = window.requestAnimationFrame(animate)
    } else {
      dismissTimer = setTimeout(() => setShowing(false), 0)
    }

    return () => {
      clearTimeout(dismissTimer)
      window.cancelAnimationFrame(animationFrame)
      window.cancelAnimationFrame(resizeFrame)
      window.removeEventListener('resize', onResize)
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, showing, intensity, isStrike])

  if (!active || !showing) return null

  return (
    <div
      aria-hidden='true'
      className={classNames(styles.root, clearing && styles.clearing, className)}
      style={{ ...fogStyle, '--thunderstorm-clear-duration': `${clearDuration}ms`, ...style }}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      {fog && <div className={styles.fog} />}
    </div>
  )
}

function makeClouds (settings) {
  const clouds = []
  let x = -settings.cloudSize[1]

  while (x < window.innerWidth + settings.cloudSize[1]) {
    const radius = randInRange(settings.cloudSize[0], settings.cloudSize[1])
    const direction = Math.random() > 0.35 ? 1 : -1

    clouds.push({
      x,
      y: randInRange(-radius * 0.25, radius * 0.35),
      radius,
      speed: randInRange(settings.wind * 0.4, settings.wind) * direction,
      alpha: randInRange(0.18, 0.38)
    })

    x += randInRange(settings.cloudGap[0], settings.cloudGap[1])
  }

  return clouds
}

function drawFrame (context, clouds, bolts, isStrike) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)

  if (!isStrike) {
    drawSky(context)

    clouds.forEach(cloud => {
      const gradient = context.createRadialGradient(
        cloud.x, cloud.y, cloud.radius * 0.1,
        cloud.x, cloud.y, cloud.radius
      )
      gradient.addColorStop(0, `rgba(255, 255, 255, ${cloud.alpha})`)
      gradient.addColorStop(0.65, `rgba(170, 174, 184, ${cloud.alpha * 0.8})`)
      gradient.addColorStop(1, 'rgba(170, 174, 184, 0)')

      context.beginPath()
      context.fillStyle = gradient
      context.arc(cloud.x, cloud.y, cloud.radius, 0, 2 * Math.PI)
      context.fill()
    })
  }

  bolts.forEach(bolt => drawBolt(context, bolt))
}

function drawSky (context) {
  const gradient = context.createLinearGradient(0, 0, 0, window.innerHeight)
  gradient.addColorStop(0, 'rgba(5, 7, 12, 0.3)')
  gradient.addColorStop(0.4, 'rgba(10, 12, 20, 0.16)')
  gradient.addColorStop(1, 'rgba(10, 12, 20, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, window.innerWidth, window.innerHeight)
}

function drawBolt (context, bolt) {
  const flashDuration = 0.05
  if (bolt.flash && bolt.flashAge < flashDuration) {
    const flashAlpha = 0.22 * (1 - bolt.flashAge / flashDuration)
    context.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`
    context.fillRect(0, 0, window.innerWidth, window.innerHeight)
  }

  const alpha = bolt.growing ? 0.95 : Math.max(0, 1 - bolt.age / bolt.fadeDuration) * 0.95

  context.save()
  context.shadowColor = 'rgba(250, 218, 94, 1)'
  context.shadowBlur = 8
  context.strokeStyle = `rgba(250, 218, 94, ${alpha})`
  context.lineWidth = bolt.lineWidth
  context.stroke(bolt.path)
  context.restore()

  bolt.children.forEach(child => drawBolt(context, child))
}

class StormBolt {
  constructor (options = {}) {
    const opts = {
      startPoint: [0, 0],
      length: 100,
      angle: 90,
      branches: 20,
      maxBranches: 10,
      lineWidth: 3,
      flash: true,
      ...BOLT_STORM,
      ...options
    }

    this.startPoint = opts.startPoint
    this.length = opts.length
    this.angle = opts.angle
    this.speed = opts.speed
    this.spread = opts.spread
    this.branches = opts.branches
    this.maxBranches = opts.maxBranches
    this.lineWidth = opts.lineWidth
    this.flash = opts.flash
    this.growthRate = opts.growthRate
    this.childGrowthRate = opts.childGrowthRate
    this.fadeDuration = opts.fadeDuration
    this.speedDecay = opts.speedDecay
    this.spreadDecay = opts.spreadDecay
    this.childMaxBranches = opts.childMaxBranches

    this.point = [opts.startPoint[0], opts.startPoint[1]]
    this.lastAngle = opts.angle
    this.children = []
    this.path = new Path2D()
    this.path.moveTo(this.point[0], this.point[1])
    this.age = 0
    this.flashAge = 0
    this.growing = true
    this.done = false
    this.segmentDebt = 0
  }

  step (deltaTime, isChild) {
    if (!this.done) {
      if (!this.growing) {
        this.age += deltaTime
        if (this.flash) this.flashAge += deltaTime
        this.done = this.age > this.fadeDuration
      } else {
        const rate = isChild ? this.childGrowthRate : this.growthRate
        this.segmentDebt += rate * deltaTime
        const steps = Math.floor(this.segmentDebt)
        this.segmentDebt -= steps

        for (let i = 0; i < steps && this.growing; i++) {
          const distance = Math.sqrt(
            Math.pow(this.point[0] - this.startPoint[0], 2) +
            Math.pow(this.point[1] - this.startPoint[1], 2)
          )

          if (distance >= this.length || this.point[1] >= window.innerHeight) {
            this.growing = false
            break
          }

          this.addSegment(distance)
        }
      }
    }

    this.children.forEach(child => child.step(deltaTime, true))
  }

  isTreeDone () {
    return this.done && this.children.every(c => c.isTreeDone())
  }

  addSegment (distance) {
    const angleChange = randInRange(1, this.spread)
    this.lastAngle += this.lastAngle > this.angle ? -angleChange : angleChange
    const radians = this.lastAngle * Math.PI / 180
    this.point[0] += Math.cos(radians) * this.speed
    this.point[1] += Math.sin(radians) * this.speed
    this.path.lineTo(this.point[0], this.point[1])

    if (randInRange(0, 99) < this.branches && this.children.length < this.maxBranches) {
      this.children.push(new StormBolt({
        startPoint: [this.point[0], this.point[1]],
        length: Math.max(distance * 0.8, this.speed),
        angle: this.lastAngle + randInRange(350 - this.spread, 370 + this.spread),
        speed: Math.max(this.speed - this.speedDecay, 24),
        spread: Math.max(this.spread - this.spreadDecay, 8),
        branches: this.branches,
        maxBranches: this.childMaxBranches,
        lineWidth: Math.max(this.lineWidth - 1, 1),
        flash: false,
        growthRate: this.growthRate,
        childGrowthRate: this.childGrowthRate,
        fadeDuration: this.fadeDuration,
        speedDecay: this.speedDecay,
        spreadDecay: this.spreadDecay,
        childMaxBranches: this.childMaxBranches
      }))
    }
  }
}

export default dynamic(() => Promise.resolve(Thunderstorm), { ssr: false })
