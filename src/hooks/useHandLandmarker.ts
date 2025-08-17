import { useEffect, useMemo, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export function useHandLandmarker() {
  const [isModelReady, setIsModelReady] = useState(false)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)

  const wasmBaseUrl = useMemo(
    () => 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    []
  )

  const modelUrl = useMemo(
    () =>
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    []
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(wasmBaseUrl)
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrl },
          numHands: 1,
          runningMode: 'VIDEO',
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
      handLandmarkerRef.current?.close()
      handLandmarkerRef.current = null
    }
  }, [modelUrl, wasmBaseUrl])

  return { isModelReady, handLandmarkerRef }
}


