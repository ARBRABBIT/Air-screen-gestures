import type { DrawingMode } from '../types'

type Props = {
  isCameraOn: boolean
  isModelReady: boolean
  strokeColor: string
  strokeSize: number
  drawWithPinch: boolean
  mirrored: boolean
  drawingMode: DrawingMode
  smoothing: number
  pressureSensitivity: boolean
  currentPressure?: number
  onStartStop: () => void
  onClear: () => void
  onChangeColor: (color: string) => void
  onChangeSize: (size: number) => void
  onTogglePinch: (enabled: boolean) => void
  onToggleMirror: (enabled: boolean) => void
  onChangeMode: (mode: DrawingMode) => void
  onChangeSmoothing: (smoothing: number) => void
  onTogglePressure: (enabled: boolean) => void
}

export function ControlsBar({
  isCameraOn,
  isModelReady,
  strokeColor,
  strokeSize,
  drawWithPinch,
  mirrored,
  drawingMode,
  smoothing,
  pressureSensitivity,
  currentPressure,
  onStartStop,
  onClear,
  onChangeColor,
  onChangeSize,
  onTogglePinch,
  onToggleMirror,
  onChangeMode,
  onChangeSmoothing,
  onTogglePressure,
}: Props) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-[95vw] px-4 z-30">
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl shadow-soft p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onStartStop}
              disabled={!isModelReady}
              className={`px-6 py-3 rounded-xl text-base font-medium transition ${
                isCameraOn ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15'
              } ${!isModelReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isCameraOn ? 'Stop Camera' : isModelReady ? 'Start Camera' : 'Loading Model…'}
            </button>
            <button onClick={onClear} className="px-4 py-3 rounded-xl text-base bg-white/10 hover:bg-white/15">
              Clear Canvas
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-base text-neutral-200">
              Color
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => onChangeColor(e.target.value)}
                className="h-10 w-10 rounded-lg bg-transparent border border-white/20 p-0"
                aria-label="Stroke color"
              />
            </label>
            <label className="flex items-center gap-2 text-base text-neutral-200">
              Size
              <input
                type="range"
                min={2}
                max={32}
                step={1}
                value={strokeSize}
                onChange={(e) => onChangeSize(Number(e.target.value))}
                className="w-32 accent-white"
                aria-label="Stroke size"
              />
            </label>
            <label className="flex items-center gap-2 text-base text-neutral-200">
              <input
                type="checkbox"
                checked={drawWithPinch}
                onChange={(e) => onTogglePinch(e.target.checked)}
                className="accent-white scale-125"
                aria-label="Draw with pinch"
              />
              Draw with pinch
            </label>
            <label className="flex items-center gap-2 text-base text-neutral-200">
              <input
                type="checkbox"
                checked={mirrored}
                onChange={(e) => onToggleMirror(e.target.checked)}
                className="accent-white scale-125"
                aria-label="Mirror view"
              />
              Mirror
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              Drawing Mode:
              <select
                value={drawingMode}
                onChange={(e) => onChangeMode(e.target.value as DrawingMode)}
                className="px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-white/30 transition-colors dropdown"
              >
                <option value="pen">Pen</option>
                <option value="brush">Brush</option>
                <option value="spray">Spray</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-neutral-300">
              Smoothing:
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  value={smoothing}
                  onChange={(e) => onChangeSmoothing(Number(e.target.value))}
                  className="w-24 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((smoothing - 0.1) / 0.8) * 100}%, rgba(255,255,255,0.2) ${((smoothing - 0.1) / 0.8) * 100}%, rgba(255,255,255,0.2) 100%)`
                  }}
                  aria-label="Smoothing level"
                />
                <span className="text-xs text-blue-400 w-8 font-medium">{Math.round(smoothing * 100)}%</span>
                <span className="text-xs text-neutral-400 w-16">
                  {smoothing <= 0.3 ? 'Sharp' : smoothing <= 0.6 ? 'Medium' : 'Smooth'}
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={pressureSensitivity}
                onChange={(e) => onTogglePressure(e.target.checked)}
                className="accent-white scale-110"
                aria-label="Pressure sensitivity"
              />
              Pressure Sensitivity
            </label>
            {pressureSensitivity && isCameraOn && (
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <span>Pressure:</span>
                <div className="w-16 h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-100"
                    style={{ width: `${Math.round((currentPressure || 0) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-400 w-8">
                  {Math.round((currentPressure || 0) * 100)}%
                </span>
              </div>
            )}
            <div className="text-xs text-neutral-400">
              {drawingMode === 'pen' && 'Smooth lines with pressure'}
              {drawingMode === 'brush' && 'Natural brush strokes'}
              {drawingMode === 'spray' && 'Spray paint effect'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ControlsBar


