import type { DrawingMode, Point } from '../types'

export function drawLine(
  canvas: HTMLCanvasElement,
  from: Point,
  to: Point,
  strokeColor: string,
  strokeSize: number,
  pressureSensitivity: boolean,
  mode: DrawingMode,
  pressure: number = 1
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const effectiveStrokeSize = pressureSensitivity ? strokeSize * pressure : strokeSize

  ctx.save()
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = strokeColor
  ctx.lineWidth = effectiveStrokeSize
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 1.0
  ctx.globalCompositeOperation = 'source-over'
  ctx.beginPath()

  if (mode === 'spray') {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.hypot(dx, dy)
    const numDots = Math.max(5, Math.floor(distance / 3))
    for (let i = 0; i <= numDots; i++) {
      const t = i / numDots
      const x = from.x + dx * t + (Math.random() - 0.5) * 15
      const y = from.y + dy * t + (Math.random() - 0.5) * 15
      ctx.beginPath()
      ctx.arc(x, y, effectiveStrokeSize * 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (mode === 'brush') {
    ctx.lineWidth = effectiveStrokeSize * 2.0
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 1.5
      ctx.beginPath()
      ctx.moveTo(from.x + offset, from.y + offset)
      ctx.lineTo(to.x + offset, to.y + offset)
      ctx.stroke()
    }
  } else {
    ctx.lineWidth = effectiveStrokeSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.closePath()
  }

  ctx.restore()

  // Trigger a subtle repaint
  const ctx2 = canvas.getContext('2d')
  if (ctx2) {
    ctx2.save()
    ctx2.globalAlpha = 0.01
    ctx2.fillRect(0, 0, 1, 1)
    ctx2.restore()
  }
}

export function resizeCanvasToContainer(canvas: HTMLCanvasElement) {
  const container = canvas.parentElement
  if (!container) return
  const containerRect = container.getBoundingClientRect()
  canvas.width = containerRect.width
  canvas.height = containerRect.height
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }
}


// MediaPipe hand connections as index pairs (subset for clarity; can be extended)
const HAND_CONNECTIONS: Array<[number, number]> = [
  // Palm
  [0, 1], [1, 2], [2, 5], [5, 9], [9, 13], [13, 17], [17, 0],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
]

export type Landmark = { x: number; y: number }

// Draws hand skeleton lines and fingertip dots for one or two hands
export function drawHandOverlay(
  canvas: HTMLCanvasElement,
  hands: Array<Landmark[]>,
  options?: { mirrored?: boolean }
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { mirrored = false } = options ?? {}

  ctx.save()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.fillStyle = 'red'

  for (const landmarks of hands) {
    // Draw connections
    for (const [a, b] of HAND_CONNECTIONS) {
      const p1 = landmarks[a]
      const p2 = landmarks[b]
      if (!p1 || !p2) continue

      const x1 = (mirrored ? 1 - p1.x : p1.x) * canvas.width
      const y1 = p1.y * canvas.height
      const x2 = (mirrored ? 1 - p2.x : p2.x) * canvas.width
      const y2 = p2.y * canvas.height

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    // Draw red dots on all landmarks (smaller for non-tips)
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i]
      const x = (mirrored ? 1 - lm.x : lm.x) * canvas.width
      const y = lm.y * canvas.height
      const radius = i % 4 === 0 ? 4 : 3
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}


