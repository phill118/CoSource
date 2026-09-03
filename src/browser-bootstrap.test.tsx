// @vitest-environment jsdom
import { waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

afterEach(() => {
  document.body.innerHTML = ''
  Reflect.deleteProperty(document, 'modelContext')
  vi.resetModules()
})

describe('browser bootstrap', () => {
  it('configures Zod as jitless before rendering and registering application tools', async () => {
    z.config({ jitless: false })
    document.body.innerHTML = '<div id="root"></div>'
    const tools = new Map<string, WebMCPToolDefinition>()
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        async registerTool(
          tool: WebMCPToolDefinition,
          options?: { signal?: AbortSignal },
        ) {
          tools.set(tool.name, tool)
          options?.signal?.addEventListener('abort', () => tools.delete(tool.name), {
            once: true,
          })
        },
      }),
    })

    await import('./main.tsx')

    await waitFor(() => expect(document.body).toHaveTextContent('CoSource'))
    await waitFor(() => expect(tools.size).toBe(13))
    expect(z.config().jitless).toBe(true)
  })
})
