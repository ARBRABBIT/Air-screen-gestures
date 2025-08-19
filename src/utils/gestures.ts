import type { Point } from '../types'
import type { MutableRefObject, RefObject } from 'react'

export function isPinching(indexTip: { x: number; y: number }, thumbTip: { x: number; y: number }) {
  const dx = indexTip.x - thumbTip.x
  const dy = indexTip.y - thumbTip.y
  return Math.hypot(dx, dy) < 0.08
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

// Basic geometric sanity checks to reject false-positive "hands" (e.g., faces)
export function isLikelyValidHand(landmarks: Array<{ x: number; y: number }>): boolean {
  if (!landmarks || landmarks.length < 21) return false
  const wrist = landmarks[0]
  const indexMCP = landmarks[5]
  const pinkyMCP = landmarks[17]
  const indexTip = landmarks[8]
  const thumbTip = landmarks[4]
  if (!wrist || !indexMCP || !pinkyMCP || !indexTip || !thumbTip) return false
  // Palm must be wider than a tiny threshold in normalized space
  const palmWidth = normalizedDistance(landmarks, 5, 17)
  // Relax threshold slightly for mobile cameras where FOV/scale varies
  if (!(palmWidth > 0.12)) return false
  // Tips should generally lie above wrist (smaller y in normalized coords)
  const tipsAboveWrist = (indexTip.y < wrist.y + 0.2) && (thumbTip.y < wrist.y + 0.25)
  if (!tipsAboveWrist) return false
  return true
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
  indexWinsWithMargin: boolean
} {
  // Distances from thumb tip (4) to each fingertip
  const indexDist = normalizedDistance(landmarks, 4, 8)
  const middleDist = normalizedDistance(landmarks, 4, 12)
  const ringDist = normalizedDistance(landmarks, 4, 16)
  const pinkyDist = normalizedDistance(landmarks, 4, 20)

  const pairs = [
    { tipIndex: 8, norm: indexDist },
    { tipIndex: 12, norm: middleDist },
    { tipIndex: 16, norm: ringDist },
    { tipIndex: 20, norm: pinkyDist },
  ]

  const closest = pairs.reduce((min, cur) => (cur.norm < min.norm ? cur : min), {
    tipIndex: null as unknown as number,
    norm: Number.POSITIVE_INFINITY,
  })

  // Consider index “closest enough” if within a small margin of the closest finger
  const margin = 0.06
  const minOther = Math.min(middleDist, ringDist, pinkyDist)
  const indexWinsWithMargin = indexDist <= minOther + margin

  const closeThreshold = 0.42
  const pinching = indexDist < closeThreshold

  return { pinching, norm: indexDist, closestTipIndex: closest.tipIndex, indexWinsWithMargin }
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


