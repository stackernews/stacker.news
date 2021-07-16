import React, { useRef, useEffect, useContext } from 'react'
import { randInRange } from '../lib/rand'

export const LightningContext = React.createContext({
  bolts: 0,
  strike: () => {}
})

export class LightningProvider extends React.Component {
  state = {
    bolts: 0,
    strike: (repeat) => {
      this.setState(state => {
        return {
          ...this.state,
          bolts: this.state.bolts + 1
        }
      })
    }
  }

  render () {
    const { state, props: { children } } = this
    return (
      <LightningContext.Provider value={state}>
        {new Array(this.state.bolts).fill(null).map((_, i) => <Lightning key={i} />)}
        {children}
      </LightningContext.Provider>
    )
  }
}

export const LightningConsumer = LightningContext.Consumer
export function useLightning () {
  const { strike } = useContext(LightningContext)
  return strike
}

export function Lightning () {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const bolt = new Bolt(context, {
      startPoint: [Math.random() * (canvas.width * 0.5) + (canvas.width * 0.25), 0],
      length: canvas.height,
      speed: 100,
      spread: 30,
      branches: 20
    })
    bolt.draw()
  }, [])

  return <canvas className='position-fixed' ref={canvasRef} style={{ zIndex: -1 }} />
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

  const radians = this.options.angle * Math.PI / 180
  this.endPoint = [
    this.options.startPoint[0] + Math.cos(radians) * this.options.length,
    this.options.startPoint[1] + Math.sin(radians) * this.options.length
  ]

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

    // make skinnier?
    // ctx.lineWidth = ctx.lineWidth * 0.98

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
      return
    }

    setTimeout(() => { this.fade() }, 50)
  }
}
