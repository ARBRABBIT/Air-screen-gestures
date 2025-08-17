import type { Point } from '../types'

type Props = {
  isCameraOn: boolean
  lastPoint: Point | null
  drawingModeLabel: string
  smoothingPercent: number
}

export default function StatusIndicators({ isCameraOn, lastPoint, drawingModeLabel, smoothingPercent }: Props) {
  return (
    <>
      {isCameraOn && lastPoint && (
        <div
          className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white z-30 pointer-events-none"
          style={{ left: `${lastPoint.x - 8}px`, top: `${lastPoint.y - 8}px`, transform: 'translate(-50%, -50%)' }}
        />
      )}

      {isCameraOn && (
        <div className="absolute top-4 right-4 z-30">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400 font-medium">
              {lastPoint ? 'Hand Detected' : 'Searching for Hand...'}
            </span>
          </div>
        </div>
      )}

      {isCameraOn && lastPoint && (
        <div className="absolute top-16 right-4 z-30">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-400 font-medium">Drawing Active - Pinch to Draw</span>
          </div>
        </div>
      )}

      {isCameraOn && (
        <div className="absolute top-28 right-4 z-30">
          <div className="flex flex-col gap-1 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-400 font-medium">Mode: {drawingModeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-400 font-medium">Smoothing: {smoothingPercent}%</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


