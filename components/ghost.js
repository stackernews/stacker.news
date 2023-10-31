import React, { useRef, useEffect, useContext } from 'react'

export const GhostContext = React.createContext(() => {})

export class GhostProvider extends React.Component {
  state = {
    ghosts: []
  }

  strike = () => {
    const should = window.localStorage.getItem('lnAnimate') || 'yes'
    if (should === 'yes') {
      this.setState(state => {
        return {
          ghosts: [...state.ghosts, <Ghost key={state.ghosts.length} onDone={() => this.unstrike(state.ghosts.length)} />]
        }
      })
      return true
    }
    return false
  }

  unstrike = (index) => {
    this.setState(state => {
      const ghosts = [...state.ghosts]
      ghosts[index] = null
      return { ghosts }
    })
  }

  render () {
    const { props: { children } } = this
    return (
      <GhostContext.Provider value={this.strike}>
        {this.state.ghosts}
        {children}
      </GhostContext.Provider>
    )
  }
}

export const GhostConsumer = GhostContext.Consumer
export function useGhost () {
  return useContext(GhostContext)
}

function getRandom (min, max) {
  return Math.random() * (max - min) + min
}

export function Ghost ({ onDone }) {
  const canvasRef = useRef(null)
  const textureRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const texture = textureRef.current
    if (canvas.ghost) return

    try {
      canvas.ghost = new GhostCanvas(canvas, texture, {
        size: getRandom(0.025, 0.075),
        tail: {
          dotsNumber: 25, // Math.floor(getRandom(10, 50)),
          spring: 1.4, // getRandom(1, 1.8),
          friction: 0.25, // getRandom(0.1, 0.25),
          maxGravity: 250,
          gravity: getRandom(5, 250)
        },
        smile: 1,
        mainColor: [getRandom(0.8, 1), getRandom(0.8, 1), getRandom(0.8, 1)],
        borderColor: [getRandom(0, 0.2), getRandom(0, 0.2), getRandom(0, 0.2)], // [0.2, 0.5, 0.7],
        isFlatColor: false,
        onDone
      })
    } catch (e) {
      console.error(e)
    }
  }, [canvasRef, textureRef, onDone])

  return (
    <>
      <canvas
        className='position-fixed'
        ref={canvasRef} style={{ zIndex: 10000, background: 'transparent', pointerEvents: 'none', display: 'block', height: '100vh', width: '100vw' }}
      />
      <canvas
        ref={textureRef} style={{ display: 'none' }}
      />
    </>
  )
}

const GhostCanvas = (canvas, texture, params) => {
  const mouseThreshold = 1
  const devicePixelRatio = Math.min(window.devicePixelRatio, 2)

  function getRandomOffscreen () {
    return Math.random() > 0.5
      ? {
          x: getRandom(0, window.innerWidth),
          y: Math.random() > 0.5 ? getRandom(-200, -100) : getRandom(window.innerHeight + 100, window.innerHeight + 200)
        }
      : {
          x: Math.random() > 0.5 ? getRandom(-200, -100) : getRandom(window.innerWidth + 100, window.innerWidth + 200),
          y: getRandom(0, window.innerHeight)
        }
  }

  function getRandomOnScreen () {
    return {
      x: getRandom(0.1 * window.innerWidth, 0.9 * window.innerWidth),
      y: getRandom(0.1 * window.innerHeight, 0.9 * window.innerHeight)
    }
  }

  const mouse = {
    ...getRandomOffscreen(),
    tX: 0,
    tY: 0,
    moving: false
  }

  const textureCtx = texture.getContext('2d')
  const pointerTrail = new Array(params.tail.dotsNumber)
  const dotSize = (i) =>
    params.size *
      window.innerHeight *
      (1 - 0.2 * Math.pow((3 * i) / params.tail.dotsNumber - 1, 2))
  for (let i = 0; i < params.tail.dotsNumber; i++) {
    pointerTrail[i] = {
      x: mouse.x,
      y: mouse.y,
      vx: 0,
      vy: 0,
      opacity: 0.04 + getRandom(0.25, 0.35) * Math.pow(1 - i / params.tail.dotsNumber, 4),
      bordered: 0.6 * Math.pow(1 - i / pointerTrail.length, 1),
      r: dotSize(i)
    }
  }

  let uniforms
  const gl = initShader()
  if (!gl) return

  function generateRandomPath () {
    const startPoint = {
      x: mouse.x,
      y: mouse.y
    }

    const numSegments = 1 // Adjust for more or fewer segments
    const path = []

    let lastEndPoint = startPoint
    for (let i = 0; i < numSegments; i++) {
      const controlPoint1 = getRandomOnScreen()
      // const controlPoint2 = getRandomOnScreen()
      const endPoint = getRandomOnScreen()

      path.push({ bezier: [lastEndPoint, controlPoint1, endPoint, endPoint] })
      lastEndPoint = endPoint
    }

    path.push({ pause: getRandom(500, 2000) })
    const finalPoint = getRandomOffscreen()
    path.push(finalPoint)

    return path
  }

  const path = generateRandomPath()
  let currentPathIndex = 0
  let pathStartTime = null
  const segmentDuration = getRandom(750, 1500) // How long each Bezier segment should take

  function evaluateBezier (bezier, t) {
    const [p0, p1, p2, p3] = bezier

    const oneMinusT = 1 - t
    const x = Math.pow(oneMinusT, 3) * p0.x +
            3 * Math.pow(oneMinusT, 2) * t * p1.x +
            3 * oneMinusT * t * t * p2.x +
            t * t * t * p3.x

    const y = Math.pow(oneMinusT, 3) * p0.y +
            3 * Math.pow(oneMinusT, 2) * t * p1.y +
            3 * oneMinusT * t * t * p2.y +
            t * t * t * p3.y

    return { x, y }
  }

  function interpolate (start, end, factor) {
    return start + (end - start) * factor
  }

  function updateMousePositionBasedOnPath (currentTime) {
    if (!pathStartTime) {
      pathStartTime = currentTime
    }

    const currentSegment = path[currentPathIndex]

    if (currentSegment.pause) {
      mouse.moving = false
      if (currentTime - pathStartTime > currentSegment.pause) {
        mouse.moving = true
        currentPathIndex++
        pathStartTime = null
      }
      return
    }

    if (currentSegment.bezier) {
      const t = (currentTime - pathStartTime) / segmentDuration
      if (t <= 1) {
        const position = evaluateBezier(currentSegment.bezier, t)
        mouse.tX = position.x
        mouse.tY = position.y
      } else {
        currentPathIndex++
        pathStartTime = null
      }
      return
    }

    // Linear segment
    const factor = (currentTime - pathStartTime) / segmentDuration
    if (factor < 1) {
      mouse.tX = interpolate(mouse.x, currentSegment.x, factor)
      mouse.tY = interpolate(mouse.y, currentSegment.y, factor)
    } else {
      currentPathIndex++
      pathStartTime = null
    }
  }

  resizeCanvas()
  render()
  mouse.moving = true

  function initShader () {
    const vsSource = vertShader
    const fsSource = fragShader

    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')

    if (!gl) {
      console.log('WebGL is not supported by your browser.')
      return
    }

    function createShader (gl, sourceCode, type) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, sourceCode)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(
          'An error occurred compiling the shaders: ' +
              gl.getShaderInfoLog(shader)
        )
        gl.deleteShader(shader)
        return null
      }

      return shader
    }

    const vertexShader = createShader(gl, vsSource, gl.VERTEX_SHADER)
    const fragmentShader = createShader(gl, fsSource, gl.FRAGMENT_SHADER)

    function createShaderProgram (gl, vertexShader, fragmentShader) {
      const program = gl.createProgram()
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(
          'Unable to initialize the shader program: ' +
              gl.getProgramInfoLog(program)
        )
        return null
      }

      return program
    }

    const shaderProgram = createShaderProgram(
      gl,
      vertexShader,
      fragmentShader
    )
    uniforms = getUniforms(shaderProgram)

    function getUniforms (program) {
      const uniforms = []
      const uniformCount = gl.getProgramParameter(
        program,
        gl.ACTIVE_UNIFORMS
      )
      for (let i = 0; i < uniformCount; i++) {
        const uniformName = gl.getActiveUniform(program, i).name
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName)
      }
      return uniforms
    }

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    gl.useProgram(shaderProgram)

    const positionLocation = gl.getAttribLocation(
      shaderProgram,
      'a_position'
    )
    gl.enableVertexAttribArray(positionLocation)

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const canvasTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, canvasTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      texture
    )
    gl.uniform1i(uniforms.u_texture, 0)

    gl.uniform1f(uniforms.u_size, params.size)
    gl.uniform3f(
      uniforms.u_main_color,
      params.mainColor[0],
      params.mainColor[1],
      params.mainColor[2]
    )
    gl.uniform3f(
      uniforms.u_border_color,
      params.borderColor[0],
      params.borderColor[1],
      params.borderColor[2]
    )

    return gl
  }

  function updateTexture () {
    textureCtx.fillStyle = 'black'
    textureCtx.fillRect(0, 0, texture.width, texture.height)

    pointerTrail.forEach((p, pIdx) => {
      if (Number.isNaN(mouse.x) || Number.isNaN(mouse.y)) {
        return
      }

      if (pIdx === 0) {
        p.x = mouse.x
        p.y = mouse.y
      } else {
        p.vx += (pointerTrail[pIdx - 1].x - p.x) * params.tail.spring
        p.vx *= params.tail.friction

        p.vy += (pointerTrail[pIdx - 1].y - p.y) * params.tail.spring
        p.vy *= params.tail.friction
        p.vy += params.tail.gravity
        p.x += p.vx
        p.y += p.vy
      }

      const grd = textureCtx.createRadialGradient(
        p.x,
        p.y,
        p.r * p.bordered,
        p.x,
        p.y,
        p.r
      )
      grd.addColorStop(
        0,
        'rgba(255, 255, 255, ' + p.opacity + ')'
      )
      grd.addColorStop(1, 'rgba(255, 255, 255, 0)')

      textureCtx.beginPath()
      textureCtx.fillStyle = grd
      textureCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      textureCtx.fill()
    })
  }

  function render () {
    if (currentPathIndex > path.length - 1) {
      params.onDone()
      return
    }
    const currentTime = performance.now()
    updateMousePositionBasedOnPath(currentTime)
    gl.uniform1f(uniforms.u_time, currentTime)

    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    if (mouse.moving) {
      params.smile -= 0.05
      params.smile = Math.max(params.smile, -0.1)
      params.tail.gravity -= 10 * params.size
      params.tail.gravity = Math.max(params.tail.gravity, 0)
    } else {
      params.smile += 0.01
      params.smile = Math.min(params.smile, 1)
      if (params.tail.gravity > 30 * params.size) {
        params.tail.gravity =
            (30 + 9 * (1 + Math.sin(0.002 * currentTime))) * params.size
      } else {
        params.tail.gravity += params.size
      }
    }

    mouse.x += (mouse.tX - mouse.x) * mouseThreshold
    mouse.y += (mouse.tY - mouse.y) * mouseThreshold

    gl.uniform1f(uniforms.u_smile, params.smile)
    gl.uniform2f(
      uniforms.u_pointer,
      mouse.x / window.innerWidth,
      1 - mouse.y / window.innerHeight
    )
    gl.uniform2f(
      uniforms.u_target_pointer,
      mouse.tX / window.innerWidth,
      1 - mouse.tY / window.innerHeight
    )

    updateTexture()

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      texture
    )
    window.requestAnimationFrame(render)
  }

  function resizeCanvas () {
    canvas.width = window.innerWidth * devicePixelRatio
    canvas.height = window.innerHeight * devicePixelRatio
    texture.width = window.innerWidth
    texture.height = window.innerHeight
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform1f(uniforms.u_ratio, canvas.width / canvas.height)
    for (let i = 0; i < params.tail.dotsNumber; i++) {
      pointerTrail[i].r = dotSize(i)
    }
  }
}

const vertShader = `
  precision mediump float;

  varying vec2 vUv;
  attribute vec2 a_position;

  void main() {
      vUv = .5 * (a_position + 1.);
      gl_Position = vec4(a_position, 0.0, 1.0);
  }`

const fragShader = `
precision mediump float;

varying vec2 vUv;
uniform float u_time;
uniform float u_ratio;
uniform float u_size;
uniform vec2 u_pointer;
uniform float u_smile;
uniform vec2 u_target_pointer;
uniform vec3 u_main_color;
uniform vec3 u_border_color;
uniform float u_flat_color;
uniform sampler2D u_texture;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}
vec2 rotate(vec2 v, float angle) {
    float r_sin = sin(angle);
    float r_cos = cos(angle);
    return vec2(v.x * r_cos - v.y * r_sin, v.x * r_sin + v.y * r_cos);
}

float eyes(vec2 uv) {
    uv.y -= .5;
    uv.x *= 1.;
    uv.y *= .8;
    uv.x = abs(uv.x);
    uv.y += u_smile * .3 * pow(uv.x, 1.3);
    uv.x -= (.6 + .2 * u_smile);

    float d = clamp(length(uv), 0., 1.);
    return 1. - pow(d, .08);
}

float mouth(vec2 uv) {
    uv.y += 1.5;

    uv.x *= (.5 + .5 * abs(1. - u_smile));
    uv.y *= (3. - 2. * abs(1. - u_smile));
    uv.y -= u_smile * 4. * pow(uv.x, 2.);

    float d = clamp(length(uv), 0., 1.);
    return 1. - pow(d, .07);
}

float face(vec2 uv, float rotation) {
    uv = rotate(uv, rotation);
    uv /= (.27 * u_size);

    float eyes_shape = 10. * eyes(uv);
    float mouth_shape = 20. * mouth(uv);

    float col = 0.;
    col = mix(col, 1., eyes_shape);
    col = mix(col, 1., mouth_shape);

    return col;
}

void main() {

    vec2 point = u_pointer;
    point.x *= u_ratio;

    vec2 uv = vUv;
    uv.x *= u_ratio;
    uv -= point;

    float texture = texture2D(u_texture, vec2(vUv.x, 1. - vUv.y)).r;
    float shape = texture;

    float noise = snoise(uv * vec2(.7 / u_size, .6 / u_size) + vec2(0., .0015 * u_time));
    noise += 1.2;
    noise *= 2.1;
    noise += smoothstep(-.8, -.2, (uv.y) / u_size);

    float face = face(uv, 5. * (u_target_pointer.x - u_pointer.x));
    shape -= face;

    shape *= noise;

    vec3 border = (1. - u_border_color);
    border.g += .2 * sin(.005 * u_time);
    border *= .5;

    vec3 color = u_main_color;
    color -= (1. - u_flat_color) * border * smoothstep(.0, .01, shape);

    shape = u_flat_color * smoothstep(.8, 1., shape) + (1. - u_flat_color) * shape;
    color *= shape;

    gl_FragColor = vec4(color, shape);
}`
