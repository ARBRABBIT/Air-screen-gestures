import type { Point } from '../types'
import type { MutableRefObject, RefObject } from 'react'

export function isPinching(indexTip: { x: number; y: number }, thumbTip: { x: number; y: number }) {
  const dx = indexTip.x - thumbTip.x
  const dy = indexTip.y - thumbTip.y
  const dist = Math.hypot(dx, dy)
  return dist < 0.08
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Returns pinch distance normalized by palm width so the threshold is scale-invariant
export function normalizedPinchDistance(landmarks: Array<{ x: number; y: number }>): number {
  const indexTip = landmarks[8]
  const thumbTip = landmarks[4]
  if (!indexTip || !thumbTip) return Number.POSITIVE_INFINITY

  const tipDist = distance(indexTip, thumbTip)

  // Palm width using index MCP (5) to pinky MCP (17) as a robust scaler
  const palmA = landmarks[5]
  const palmB = landmarks[17]
  let palmWidth = palmA && palmB ? distance(palmA, palmB) : 0

  // Fallback to wrist to middle MCP if needed
  if (!palmWidth || palmWidth < 1e-5) {
    const wrist = landmarks[0]
    const middleMCP = landmarks[9]
    palmWidth = wrist && middleMCP ? distance(wrist, middleMCP) : 0.2
  }

  return tipDist / Math.max(1e-5, palmWidth)
}

// Normalized distance helper between any two landmarks
export function normalizedDistance(
  landmarks: Array<{ x: number; y: number }>,
  aIndex: number,
  bIndex: number
): number {
  const a = landmarks[aIndex]
  const b = landmarks[bIndex]
  if (!a || !b) return Number.POSITIVE_INFINITY
  // Reuse palm-based normalization from normalizedPinchDistance
  const palmA = landmarks[5]
  const palmB = landmarks[17]
  let palmWidth = palmA && palmB ? distance(palmA, palmB) : 0
  if (!palmWidth || palmWidth < 1e-5) {
    const wrist = landmarks[0]
    const middleMCP = landmarks[9]
    palmWidth = wrist && middleMCP ? distance(wrist, middleMCP) : 0.2
  }
  return distance(a, b) / Math.max(1e-5, palmWidth)
}

// Stricter check: ensure thumb is pinching specifically with index, not other fingers
export function isIndexThumbPinching(landmarks: Array<{ x: number; y: number }>): {
  pinching: boolean
  norm: number
  closestTipIndex: number | null
} {
  // Landmark indices: thumb tip 4, index tip 8, middle 12, ring 16, pinky 20
  const distances: Array<{ tipIndex: number; norm: number }> = [8, 12, 16, 20].map((tipIndex) => ({
    tipIndex,
    norm: normalizedDistance(landmarks, 4, tipIndex),
  }))

  const closest = distances.reduce((min, cur) => (cur.norm < min.norm ? cur : min), {
    tipIndex: null as unknown as number,
    norm: Number.POSITIVE_INFINITY,
  })

  const closeThreshold = 0.40
  const pinching = closest.tipIndex === 8 && closest.norm < closeThreshold

  return { pinching, norm: closest.norm, closestTipIndex: closest.tipIndex }
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


