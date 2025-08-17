import type { Point } from '../types'
import type { MutableRefObject, RefObject } from 'react'

export function isPinching(indexTip: { x: number; y: number }, thumbTip: { x: number; y: number }) {
  const dx = indexTip.x - thumbTip.x
  const dy = indexTip.y - thumbTip.y
  const dist = Math.hypot(dx, dy)
  return dist < 0.08
}

export function calculatePressure(
  landmarks: any[],
  isDrawing: boolean,
  lastPointRef: MutableRefObject<Point | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>
): number {
  if (!isDrawing) return 0

  const indexTip = landmarks[8]
  const thumbTip = landmarks[4]
  const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y)
  const pinchPressure = Math.max(0, 1 - (pinchDist / 0.08))

  const wrist = landmarks[0]
  const middleFinger = landmarks[12]
  const handHeight = Math.abs(wrist.y - middleFinger.y)
  const heightPressure = Math.min(1, handHeight / 0.3)

  const lastPoint = lastPointRef.current
  if (lastPoint) {
    const canvas = canvasRef.current
    if (canvas) {
      const currentX = indexTip.x * canvas.width
      const currentY = indexTip.y * canvas.height
      const movement = Math.hypot(currentX - lastPoint.x, currentY - lastPoint.y)
      const movementPressure = Math.min(1, movement / 50)
      return Math.min(1, (pinchPressure + heightPressure + movementPressure) / 3)
    }
  }

  return Math.min(1, (pinchPressure + heightPressure) / 2)
}


