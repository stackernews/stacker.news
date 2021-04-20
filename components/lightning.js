
import { useRef, useEffect } from 'react'

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
      speed: options.speed,
      spread: options.spread,
      branches: options.branching
    })
    bolt.draw()
  }, [])

  return <canvas className='position-absolute' ref={canvasRef} style={{ zIndex: -1 }} />
}

// Initialize options.
const options = {
  speed: 80,
  spread: 40,
  branching: 5
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
  ctx.lineWidth = 2
  this.draw = (isChild) => {
    ctx.beginPath()
    ctx.moveTo(this.point[0], this.point[1])
    const angleChange = rand(1, this.options.spread)
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

    if (rand(0, 99) < this.options.branches && this.children.length < this.options.maxBranches) {
      this.children.push(new Bolt(ctx, {
        startPoint: [this.point[0], this.point[1]],
        length: d * 0.8,
        angle: this.lastAngle + rand(350 - this.options.spread, 370 + this.options.spread),
        resistance: this.options.resistance,
        speed: this.options.speed - 2,
        spread: this.options.spread - 2,
        branches: this.options.branches
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
      this.fade()
    }
  }

  this.fade = function () {
    ctx.shadowColor = 'rgba(250, 250, 250, .5)'
    ctx.fillStyle = 'rgba(250, 250, 250, .05)'
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

    const color = ctx.getImageData(0, 0, 1, 1)
    console.log(color.data)
    if (color.data[0] >= 250 && color.data[3] > 240) {
      ctx.fillStyle = 'rgba(250, 250, 250, 1)'
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      return
    }

    setTimeout(() => { this.fade() }, 50)
  }
}

function rand (min, max) {
  return Math.random() * (max - min) + min
}
