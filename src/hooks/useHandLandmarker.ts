import { useEffect, useMemo, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export function useHandLandmarker() {
  const [isModelReady, setIsModelReady] = useState(false)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)

  const wasmBaseUrl = useMemo(() => (
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  ), [])

  const modelUrl = useMemo(() => (
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  ), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(wasmBaseUrl)
        const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 800
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrl },
          // Mobile devices struggle with 2-hand tracking; prefer 1 for stability/perf
          numHands: isSmallScreen ? 1 : 2,
          runningMode: 'VIDEO',
          // Slightly relax thresholds on mobile for more consistent detection
          minHandDetectionConfidence: isSmallScreen ? 0.3 : 0.4,
          minHandPresenceConfidence: isSmallScreen ? 0.5 : 0.6,
          minTrackingConfidence: isSmallScreen ? 0.5 : 0.6,
        })
        if (!cancelled) {
          handLandmarkerRef.current = handLandmarker
          setIsModelReady(true)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize hand landmarker', err)
      }
    })()
    return () => {
      cancelled = true
      // Close only once
      const instance = handLandmarkerRef.current
      if (instance) instance.close()
      handLandmarkerRef.current = null
    }
  }, [modelUrl, wasmBaseUrl])

  return { isModelReady, handLandmarkerRef }
}


