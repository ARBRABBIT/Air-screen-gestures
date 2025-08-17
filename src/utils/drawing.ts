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


