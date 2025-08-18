// One Euro Filter implementation for smoothing noisy signals while preserving responsiveness
// Source concept: https://cristal.univ-lille.fr/~casiez/1euro/

function smoothingFactor(frequencyHz: number, cutoffHz: number): number {
  const r = 2 * Math.PI * cutoffHz
  return 1 / (1 + (frequencyHz / r))
}

function exponentialSmoothing(alpha: number, value: number, previous: number): number {
  return alpha * value + (1 - alpha) * previous
}

export class OneEuroFilter {
  private minCutoffHz: number
  private beta: number
  private dCutoffHz: number
  private lastTimeSeconds: number | null = null
  private lastValue: number | null = null
  private lastDerivative: number = 0

  constructor(minCutoffHz: number = 1.0, beta: number = 0.007, dCutoffHz: number = 1.0) {
    this.minCutoffHz = minCutoffHz
    this.beta = beta
    this.dCutoffHz = dCutoffHz
  }

  reset(): void {
    this.lastTimeSeconds = null
    this.lastValue = null
    this.lastDerivative = 0
  }

  filter(value: number, timestampSeconds: number): number {
    if (this.lastTimeSeconds == null || this.lastValue == null) {
      this.lastTimeSeconds = timestampSeconds
      this.lastValue = value
      return value
    }

    const deltaTime = Math.max(1e-6, timestampSeconds - this.lastTimeSeconds)
    const frequencyHz = 1 / deltaTime

    // Estimate derivative
    const derivative = (value - this.lastValue) * frequencyHz
    const dAlpha = smoothingFactor(frequencyHz, this.dCutoffHz)
    const derivativeHat = exponentialSmoothing(dAlpha, derivative, this.lastDerivative)

    // Adapt cutoff based on signal speed, with cap to avoid over-reacting at very high speeds
    const cutoff = this.minCutoffHz + this.beta * Math.min(4, Math.abs(derivativeHat))
    const alpha = smoothingFactor(frequencyHz, cutoff)
    const filteredValue = exponentialSmoothing(alpha, value, this.lastValue)

    this.lastTimeSeconds = timestampSeconds
    this.lastValue = filteredValue
    this.lastDerivative = derivativeHat

    return filteredValue
  }
}


