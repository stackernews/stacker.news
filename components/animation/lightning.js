import React, { useRef, useEffect, useContext } from 'react'
import { randInRange } from '@/lib/rand'

export const LightningContext = React.createContext(() => {})

export class LightningProvider extends React.Component {
  state = {
    bolts: []
  }

  /**
   * Strike lightning on the screen, if the user has the setting enabled
   * @returns boolean indicating whether the strike actually happened, based on user preferences
   */
  strike = () => {
    this.setState(state => {
      return {
        bolts: [...state.bolts, <Lightning key={state.bolts.length} onDone={() => this.unstrike(state.bolts.length)} />]
      }
    })
  }

  unstrike = (index) => {
    this.setState(state => {
      const bolts = [...state.bolts]
      bolts[index] = null
      return { bolts }
    })
  }

  render () {
    const { props: { children } } = this
    return (
      <LightningContext.Provider value={this.strike}>
        {this.state.bolts}
        {children}
      </LightningContext.Provider>
    )
  }
}

export const LightningConsumer = LightningContext.Consumer
export function useLightning () {
  return useContext(LightningContext)
}

export function Lightning ({ onDone }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas.bolt) return

    const context = canvas.getContext('2d')

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    canvas.bolt = new Bolt(context, {
      startPoint: [Math.random() * (canvas.width * 0.5) + (canvas.width * 0.25), 0],
      length: canvas.height,
      speed: 100,
      spread: 30,
      branches: 20,
      onDone
    })
    canvas.bolt.draw()
  }, [])

  return <canvas className='position-fixed' ref={canvasRef} style={{ zIndex: 100, pointerEvents: 'none' }} />
}

function Bolt (ctx, options) {
  this.options = {
    startPoint: [0, 0],
    length: 100,
    angle: 90,
    speed: 30,
    spread: 50,
    branches: 10,
    maxBranches: 10,
    lineWidth: 3,
    ...options
  }
  this.point = [this.options.startPoint[0], this.options.startPoint[1]]
  this.branches = []
  this.lastAngle = this.options.angle
  this.children = []

  ctx.shadowColor = 'rgba(250, 218, 94, 1)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = 'rgba(250, 250, 250, 1)'
  ctx.strokeStyle = 'rgba(250, 218, 94, 1)'
  ctx.lineWidth = this.options.lineWidth

  this.draw = (isChild) => {
    ctx.beginPath()
    ctx.moveTo(this.point[0], this.point[1])
    const angleChange = randInRange(1, this.options.spread)
    this.lastAngle += this.lastAngle > this.options.angle ? -angleChange : angleChange
    const radians = this.lastAngle * Math.PI / 180

    this.point[0] += Math.cos(radians) * this.options.speed
    this.point[1] += Math.sin(radians) * this.options.speed

    ctx.lineTo(this.point[0], this.point[1])
    ctx.stroke()

    const d = Math.sqrt(
      Math.pow(this.point[0] - this.options.startPoint[0], 2) +
      Math.pow(this.point[1] - this.options.startPoint[1], 2)
    )

    if (randInRange(0, 99) < this.options.branches && this.children.length < this.options.maxBranches) {
      this.children.push(new Bolt(ctx, {
        startPoint: [this.point[0], this.point[1]],
        length: d * 0.8,
        angle: this.lastAngle + randInRange(350 - this.options.spread, 370 + this.options.spread),
        resistance: this.options.resistance,
        speed: this.options.speed - 2,
        spread: this.options.spread - 2,
        branches: this.options.branches,
        lineWidth: ctx.lineWidth
      }))
    }

    this.children.forEach(child => {
      child.draw(true)
    })

    if (isChild) {
      return
    }

    if (d < this.options.length) {
      window.requestAnimationFrame(() => { this.draw() })
    } else {
      ctx.canvas.style.opacity = 1
      this.fade()
    }
  }

  this.fade = function () {
    ctx.canvas.style.opacity -= 0.04
    if (ctx.canvas.style.opacity <= 0) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      this.options.onDone()
      return
    }

    setTimeout(() => { this.fade() }, 50)
  }
}
