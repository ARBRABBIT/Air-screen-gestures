import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrawingMode, Point } from './types'
import { useHandLandmarker } from './hooks/useHandLandmarker'
import { useCamera } from './hooks/useCamera'
import { drawLine as drawLineUtil, resizeCanvasToContainer } from './utils/drawing'
import { calculatePressure, isPinching } from './utils/gestures'
import ControlsBar from './components/ControlsBar'
import StatusIndicators from './components/StatusIndicators'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { isModelReady, handLandmarkerRef } = useHandLandmarker()
  const { isCameraOn, startCamera, stopCamera, rafRef } = useCamera(videoRef)
  const lastPointRef = useRef<Point | null>(null)
  const pointsRef = useRef<Point[]>([])
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

  useEffect(() => { smoothingRef.current = smoothing }, [smoothing])
  useEffect(() => { drawingModeRef.current = drawingMode }, [drawingMode])
  useEffect(() => { drawWithPinchRef.current = drawWithPinch }, [drawWithPinch])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    resizeCanvasToContainer(canvas)
  }, [])

  useEffect(() => {
    if (!isModelReady) return
    setTimeout(() => {
      resizeCanvas()
    }, 100)
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
    const loop = () => {
      const video = videoRef.current
      const landmarker = handLandmarkerRef.current
      if (!video || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      
      // REMOVED: resizeCanvasToVideo() - This was clearing the canvas every frame!
      const result = landmarker.detectForVideo(video, performance.now())
      
      const landmarks = result.landmarks?.[0]
      
      if (landmarks && landmarks.length > 8) {
        const indexTip = landmarks[8]
        const thumbTip = landmarks[4]
        
        // Enhanced pinch detection with multiple finger support
        const shouldDraw = !drawWithPinchRef.current || isPinching(indexTip, thumbTip)
        
        // Calculate pressure based on finger proximity and movement
        const pressure = calculatePressure(landmarks, shouldDraw, lastPointRef, canvasRef)
        
        const canvas = canvasRef.current
        if (canvas) {
          const x = indexTip.x * canvas.width
          const y = indexTip.y * canvas.height
          
          // Improved smoothing with configurable alpha
          // Map UI smoothing (0.1 sharp → 0.9 very smooth) to EMA alpha (weight of current)
          // Higher smoothing = lower alpha = more smoothing
          const alpha = 1 - smoothingRef.current
          const last = lastPointRef.current
          const current: Point = last 
            ? { 
                x: last.x + (x - last.x) * alpha, 
                y: last.y + (y - last.y) * alpha,
                pressure 
              } 
            : { x, y, pressure }
          
          if (shouldDraw && last) {
            drawLine(last, current, pressure, drawingModeRef.current)
            pointsRef.current.push(current)
            
            // Keep only recent points for smooth curves
            if (pointsRef.current.length > 10) {
              pointsRef.current.shift()
            }
          } else {
            // Reset points when not drawing
            pointsRef.current = []
          }
          
          lastPointRef.current = current
        }
      } else {
        lastPointRef.current = null
        pointsRef.current = []
      }
      
      rafRef.current = requestAnimationFrame(loop)
    }
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
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
    if (!isCameraOn) return
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
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
