import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrawingMode, Point } from './types'
import { useHandLandmarker } from './hooks/useHandLandmarker'
import { useCamera } from './hooks/useCamera'
import { drawLine as drawLineUtil, resizeCanvasToContainer, drawHandOverlay, drawQuadraticSegment } from './utils/drawing'
import { OneEuroFilter } from './utils/filters'
import { calculatePressure, isIndexThumbPinching, isLikelyValidHand } from './utils/gestures'
import ControlsBar from './components/ControlsBar'
import StatusIndicators from './components/StatusIndicators'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const euroFiltersRef = useRef<{ x: OneEuroFilter; y: OneEuroFilter } | null>(null)
  const { isModelReady, handLandmarkerRef } = useHandLandmarker()
  const { isCameraOn, startCamera, stopCamera, rafRef } = useCamera(videoRef)
  const lastPointRef = useRef<Point | null>(null)
  const pointsRef = useRef<Point[]>([])
  const timerRef = useRef<number | null>(null)
  const videoFrameCbRef = useRef<number | null>(null)
  const [strokeColor, setStrokeColor] = useState<string>('#00E5FF')
  const [strokeSize, setStrokeSize] = useState<number>(6)
  const [drawWithPinch, setDrawWithPinch] = useState<boolean>(true)
  const [mirrored, setMirrored] = useState<boolean>(true)
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('pen')
  const [smoothing, setSmoothing] = useState<number>(0.7)
  const [pressureSensitivity, setPressureSensitivity] = useState<boolean>(true)

  // Live refs so the render loop always uses latest settings without restart
  const smoothingRef = useRef<number>(smoothing)
  const drawingModeRef = useRef<DrawingMode>(drawingMode)
  const drawWithPinchRef = useRef<boolean>(drawWithPinch)
  const pinchStableRef = useRef<{ drawing: boolean; solidFrames: number; hollowFrames: number; lockedToIndex: boolean; nonIndexFrames: number }>({ drawing: false, solidFrames: 0, hollowFrames: 0, lockedToIndex: false, nonIndexFrames: 0 })
  const pinchNormRef = useRef<number>(1)

  useEffect(() => { smoothingRef.current = smoothing }, [smoothing])
  useEffect(() => { drawingModeRef.current = drawingMode }, [drawingMode])
  useEffect(() => { drawWithPinchRef.current = drawWithPinch }, [drawWithPinch])

  // Initialize adaptive filters
  useEffect(() => {
    euroFiltersRef.current = { x: new OneEuroFilter(1.2, 0.01, 1.0), y: new OneEuroFilter(1.2, 0.01, 1.0) }
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const overlay = overlayCanvasRef.current
    if (canvas) resizeCanvasToContainer(canvas)
    if (overlay) resizeCanvasToContainer(overlay)
  }, [])

  useEffect(() => {
    if (!isModelReady) return
    // Defer to next paint without using setTimeout to avoid long-task violations
    requestAnimationFrame(() => {
      resizeCanvas()
    })
  }, [isModelReady, resizeCanvas])

  // Add resize listener for canvas
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [resizeCanvas])

  

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Reset drawing state
    lastPointRef.current = null
    pointsRef.current = []
  }, [])

  // Draw wrapper using util
  const drawLine = useCallback((from: Point, to: Point, pressure: number = 1, mode: DrawingMode) => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawLineUtil(canvas, from, to, strokeColor, strokeSize, pressureSensitivity, mode, pressure)
  }, [strokeColor, strokeSize, pressureSensitivity])

  // Enhanced hand tracking with better responsiveness
  const startLoop = useCallback(() => {
    const runDetection = () => {
      const video = videoRef.current
      const landmarker = handLandmarkerRef.current
      if (!video || !landmarker || video.readyState < 2) {
        // Try again on next animation frame
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(runDetection)
        return
      }
      const now = performance.now()
      const result = landmarker.detectForVideo(video, now)

      // Draw skeleton overlay for one or two hands
      let hands = result.landmarks ?? []
      // Filter out unlikely hands to reduce false positives on faces
      hands = hands.filter((lm) => isLikelyValidHand(lm as any))
      const overlayCanvas = overlayCanvasRef.current
      if (overlayCanvas) {
        const ctx = overlayCanvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
        if (hands.length > 0) drawHandOverlay(overlayCanvas, hands)
      }

      const landmarks = hands[0]
      
      if (landmarks && landmarks.length > 8) {
        const indexTip = landmarks[8]
        
        // Hysteresis-based pinch detection using normalized threshold and ensuring index–thumb only
        let shouldDraw = true
        if (drawWithPinchRef.current) {
          const { pinching: _pinching, norm, closestTipIndex, indexWinsWithMargin } = isIndexThumbPinching(landmarks)
          const isIndexClosest = closestTipIndex === 8 || indexWinsWithMargin
          const state = pinchStableRef.current
          
          // lock to index if it is closest for a few frames
          if (isIndexClosest) {
            state.nonIndexFrames = 0
          } else {
            state.nonIndexFrames = Math.min(10, state.nonIndexFrames + 1)
          }

          // Smooth the pinch distance to avoid flicker on fast motion
          pinchNormRef.current = pinchNormRef.current * 0.7 + norm * 0.3
          const filteredNorm = pinchNormRef.current
          const close = filteredNorm < 0.43
          const release = filteredNorm > 0.62 || state.nonIndexFrames >= 3

          if (state.drawing) {
            // require a few open frames to stop drawing
            state.hollowFrames = release ? state.hollowFrames + 1 : 0
            if (state.hollowFrames >= 4) {
              state.drawing = false
              state.solidFrames = 0
              state.lockedToIndex = false
            }
          } else {
            // require a few closed frames to start drawing
            state.solidFrames = close ? state.solidFrames + 1 : 0
            if (state.solidFrames >= 4) {
              state.drawing = true
              state.hollowFrames = 0
              state.lockedToIndex = true
              // start a fresh stroke at pinch-down to avoid connecting lines
              lastPointRef.current = null
              pointsRef.current = []
            }
          }
          shouldDraw = state.drawing
        }
        
        // Calculate pressure based on finger proximity and movement
        const pressure = calculatePressure(landmarks, shouldDraw, lastPointRef, canvasRef)
        
        const canvas = canvasRef.current
        if (canvas) {
          // Use average of index tip (8) and DIP (7) for extra stability
          const avgXNorm = (indexTip.x + landmarks[7].x) / 2
          const avgYNorm = (indexTip.y + landmarks[7].y) / 2

          // Apply One Euro filter in normalized space
          const filters = euroFiltersRef.current
          const t = now / 1000
          const filteredXNorm = filters ? filters.x.filter(avgXNorm, t) : avgXNorm
          const filteredYNorm = filters ? filters.y.filter(avgYNorm, t) : avgYNorm

          const x = filteredXNorm * canvas.width
          const y = filteredYNorm * canvas.height
          
          // Improved smoothing with configurable alpha
          // Map UI smoothing (0.1 sharp → 0.9 very smooth) to EMA alpha (weight of current)
          // Adjust dynamically: when moving faster, increase alpha so the cursor keeps up
          const baseAlpha = 1 - smoothingRef.current
          const last = lastPointRef.current
          const jitterPixels = Math.max(1.5, Math.min(canvas.width, canvas.height) * 0.002)
          const distanceFromLast = last ? Math.hypot(x - last.x, y - last.y) : Infinity
          const speedBoost = Math.min(0.6, distanceFromLast / 80) // up to +0.6 when very fast
          const alpha = Math.min(0.95, baseAlpha + speedBoost)

          let candidate: Point = { x, y, pressure }
          if (last && distanceFromLast < jitterPixels) {
            candidate = { x: last.x, y: last.y, pressure }
          }

          const current: Point = last
            ? {
                x: last.x + (candidate.x - last.x) * alpha,
                y: last.y + (candidate.y - last.y) * alpha,
                pressure,
              }
            : candidate
          
          if (shouldDraw && last) {
            // Segment long jumps to avoid gaps at high speed
            const maxStep = Math.max(6, Math.min(canvas.width, canvas.height) * 0.01)
            const totalDist = Math.hypot(current.x - last.x, current.y - last.y)
            const steps = Math.max(1, Math.ceil(totalDist / maxStep))

            let fromPoint = last
            for (let i = 1; i <= steps; i++) {
              const t = i / steps
              const segPoint: Point = {
                x: last.x + (current.x - last.x) * t,
                y: last.y + (current.y - last.y) * t,
                pressure,
              }
              const prev = pointsRef.current[pointsRef.current.length - 1]
              const usingCurve = prev && Math.hypot(fromPoint.x - segPoint.x, fromPoint.y - segPoint.y) < 40
              const mode = drawingModeRef.current
              if (usingCurve && mode === 'pen') {
                drawQuadraticSegment(canvas, prev, fromPoint, segPoint, strokeColor, strokeSize, pressureSensitivity, pressure)
              } else {
                drawLine(fromPoint, segPoint, pressure, mode)
              }
              fromPoint = segPoint
            }
            pointsRef.current.push(current)
            
            // Keep only recent points for smooth curves
            if (pointsRef.current.length > 20) {
              pointsRef.current.shift()
            }
          } else {
            // Reset points when not drawing so the next stroke starts cleanly
            pointsRef.current = []
          }
          
          lastPointRef.current = current
        }
      } else {
        lastPointRef.current = null
        pointsRef.current = []
      }
      
      // Schedule next frame
      const v = videoRef.current
      if (v && 'requestVideoFrameCallback' in v) {
        if (videoFrameCbRef.current != null && 'cancelVideoFrameCallback' in v) {
          // Safari/WebKit specific API available on some browsers
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          v.cancelVideoFrameCallback(videoFrameCbRef.current)
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        videoFrameCbRef.current = v.requestVideoFrameCallback(() => runDetection())
      } else {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(runDetection)
      }
    }
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)
    const v = videoRef.current
    if (v && 'requestVideoFrameCallback' in v) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      videoFrameCbRef.current = v.requestVideoFrameCallback(() => runDetection())
    } else {
      rafRef.current = requestAnimationFrame(runDetection)
    }
  }, [drawLine])

  // Start/stop button handler (defined after startLoop to avoid use-before-define)
  const handleStartStop = useCallback(async () => {
    if (isCameraOn) {
      stopCamera()
      clearCanvas()
      return
    }
    if (!isModelReady) return
    const ok = await startCamera()
    if (ok) {
      resizeCanvas()
      lastPointRef.current = null
      startLoop()
    }
  }, [isCameraOn, isModelReady, startCamera, stopCamera, resizeCanvas, startLoop])

  // Ensure the render loop picks up latest settings (mode, smoothing, color, size, pressure)
  useEffect(() => {
    const v = videoRef.current
    // Always cancel any pending callbacks when toggling state
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (v && videoFrameCbRef.current != null && 'cancelVideoFrameCallback' in v) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      v.cancelVideoFrameCallback(videoFrameCbRef.current)
      videoFrameCbRef.current = null
    }
    if (!isCameraOn) return
    startLoop()
  }, [isCameraOn, startLoop, drawingMode, smoothing, drawWithPinch, strokeColor, strokeSize, pressureSensitivity])

  // Reset smoothing state when these change so the effect is immediate
  useEffect(() => {
    lastPointRef.current = null
    pointsRef.current = []
  }, [drawingMode, smoothing])

  // pinch and pressure helpers are imported from utils/gestures

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
      const v = videoRef.current
      if (v && videoFrameCbRef.current != null && 'cancelVideoFrameCallback' in v) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        v.cancelVideoFrameCallback(videoFrameCbRef.current)
      }
      stopCamera()
      clearCanvas()
    }
  }, [stopCamera])

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative w-full max-w-[95vw] h-[85vh] rounded-3xl overflow-hidden shadow-soft bg-neutral-950">
          <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover opacity-50 z-0 ${mirrored ? 'scale-x-[-1]' : ''}`} playsInline muted></video>
          <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full z-10 pointer-events-none ${mirrored ? 'scale-x-[-1]' : ''}`} />
          <canvas
            ref={overlayCanvasRef}
            className={`absolute inset-0 w-full h-full z-20 pointer-events-none ${mirrored ? 'scale-x-[-1]' : ''} rounded-3xl`}
          />

          <svg className="pointer-events-none absolute inset-[1px] z-30" width="calc(100% - 2px)" height="calc(100% - 2px)" aria-hidden>
            <defs>
              <linearGradient id="multicolor-border" x1="0%" y1="0%" x2="100%" y2="0%">
                <animateTransform attributeName="gradientTransform" attributeType="XML" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="8s" repeatCount="indefinite" />
                <stop offset="0%" stopColor="#ff0080" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#00e5ff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" rx="23" ry="23" fill="none" stroke="url(#multicolor-border)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          
          <StatusIndicators
            isCameraOn={isCameraOn}
            lastPoint={lastPointRef.current}
            drawingModeLabel={drawingMode.toUpperCase()}
            smoothingPercent={Math.round(smoothing * 100)}
          />
          
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Air Draw</h1>
                <p className="mt-3 text-lg text-neutral-300">Move your hand to draw in the air. {drawWithPinch ? 'Pinch index and thumb to draw.' : 'Drawing follows your index finger.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ControlsBar
        isCameraOn={isCameraOn}
        isModelReady={isModelReady}
        strokeColor={strokeColor}
        strokeSize={strokeSize}
        drawWithPinch={drawWithPinch}
        mirrored={mirrored}
        drawingMode={drawingMode}
        smoothing={smoothing}
        pressureSensitivity={pressureSensitivity}
        currentPressure={lastPointRef.current?.pressure}
        onStartStop={handleStartStop}
        onClear={clearCanvas}
        onChangeColor={setStrokeColor}
        onChangeSize={(v: number) => setStrokeSize(v)}
        onTogglePinch={setDrawWithPinch}
        onToggleMirror={setMirrored}
        onChangeMode={setDrawingMode}
        onChangeSmoothing={setSmoothing}
        onTogglePressure={setPressureSensitivity}
      />
    </div>
  )
}

export default App
