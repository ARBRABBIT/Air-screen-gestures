// Filters out noisy logs coming from MediaPipe's WASM/WebGL runtime
// seen as warnings like:
// - "OpenGL error checking is disabled"
// - "GL version: 3.0 ... renderer: WebKit WebGL"
// - "Graph successfully started running."
// These are informational and not actionable for end-users.

type ConsoleMethod = (...args: unknown[]) => void

function createFiltered(method: ConsoleMethod, patterns: RegExp[]): ConsoleMethod {
  return (...args: unknown[]) => {
    try {
      const text = args.map(String).join(' ')
      for (const p of patterns) {
        if (p.test(text)) return
      }
    } catch {
      // no-op
    }
    method(...args)
  }
}

export function installConsoleFilters(): void {
  if ((window as any).__consoleFiltersInstalled) return

  const patterns = [
    /OpenGL error checking is disabled/i,
    /GL version: .*WebGL/i,
    /Graph successfully started running\.?/i,
    /vision_wasm_internal\.js/i,
  ]

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    debug: console.debug.bind(console),
  }

  console.log = createFiltered(original.log, patterns)
  console.info = createFiltered(original.info, patterns)
  console.warn = createFiltered(original.warn, patterns)
  console.debug = createFiltered(original.debug, patterns)

  ;(window as any).__consoleFiltersInstalled = true
}

// Auto-install early on import
installConsoleFilters()


