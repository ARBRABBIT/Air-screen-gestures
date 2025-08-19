import { useCallback, useRef, useState } from 'react'
import type { RefObject } from 'react'

export function useCamera(videoRef: RefObject<HTMLVideoElement | null>) {
  const [isCameraOn, setIsCameraOn] = useState(false)
  const rafRef = useRef<number | null>(null)

  const stopCamera = useCallback(() => {
    const video = videoRef.current
    const stream = (video?.srcObject as MediaStream | null) ?? null
    if (stream) {
      const tracks = stream.getTracks()
      for (let i = 0; i < tracks.length; i++) tracks[i].stop()
    }
    if (video) video.srcObject = null
    setIsCameraOn(false)
  }, [videoRef])

  const startCamera = useCallback(async () => {
    try {
      // Some browsers (notably iOS Safari) do not support Permissions API for camera.
      // Gracefully skip the explicit check there and rely on getUserMedia to prompt.
      try {
        // @ts-expect-error - types don't reflect partial support across browsers
        if (navigator.permissions && navigator.permissions.query) {
          const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (permissions.state === 'denied') {
            alert('Camera permission denied. Please allow camera access in your browser settings.')
            return false
          }
        }
      } catch (_) {
        // Ignore unsupported Permissions API
      }

      // Prefer modest defaults on mobile for performance and compatibility
      const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 800
      const idealWidth = isSmallScreen ? 640 : 1280
      const idealHeight = isSmallScreen ? 480 : 720

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false
      })

      const video = videoRef.current
      if (!video) return false

      video.srcObject = stream
      // Ensure inline playback on iOS Safari
      // @ts-expect-error playsInline property exists on HTMLVideoElement at runtime
      video.playsInline = true

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => resolve()
      })

      await video.play()
      setIsCameraOn(true)
      return true
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to access camera:', err)
      const error = err as Error & { name?: string }
      if (error.name === 'NotAllowedError') {
        alert('Camera access denied. Please allow camera access and try again.')
      } else if (error.name === 'NotFoundError') {
        alert('No camera found. Please connect a camera and try again.')
      } else {
        alert(`Camera error: ${error.message}`)
      }
      return false
    }
  }, [videoRef])

  return { isCameraOn, startCamera, stopCamera, rafRef }
}


