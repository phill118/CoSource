import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApplicationServer, type GatewayHandler } from './application-server'

const temporaryRoots: string[] = []

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'cosource-runtime-'))
  temporaryRoots.push(root)
  mkdirSync(join(root, 'assets'))
  writeFileSync(join(root, 'index.html'), '<!doctype html><main>CoSource shell</main>')
  writeFileSync(join(root, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  writeFileSync(join(root, 'assets', 'app-12345678.js'), 'globalThis.__cosource = true')
  return root
}

const gateway: GatewayHandler = vi.fn(async (request) => ({
  status: request.path === '/api/catalog/search' ? 200 : 404,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ ok: request.path === '/api/catalog/search' }),
}))

async function withServer(
  run: (origin: string) => Promise<void>,
  handler: GatewayHandler = gateway,
) {
  const server = createApplicationServer({ gateway: handler, staticRoot: fixtureRoot() })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

async function rawRequest(origin: string, path: string, method = 'GET') {
  const { port } = new URL(origin)
  return await new Promise<{ status: number; contentType: string; body: string; nosniff: string }>(
    (resolve, reject) => {
      const request = httpRequest(
        { host: '127.0.0.1', port, path, method },
        (response) => {
          const chunks: Buffer[] = []
          response.on('data', (chunk: Buffer) => chunks.push(chunk))
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              contentType: String(response.headers['content-type'] ?? ''),
              body: Buffer.concat(chunks).toString('utf8'),
              nosniff: String(response.headers['x-content-type-options'] ?? ''),
            }),
          )
        },
      )
      request.on('error', reject)
      request.end()
    },
  )
}

afterEach(() => {
  vi.clearAllMocks()
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('production application server', () => {
  it('declares the supplied SVG favicon in the application document', () => {
    expect(readFileSync(resolve('index.html'), 'utf8')).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    )
  })

  it('fails clearly when the production client build is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'cosource-runtime-missing-'))
    temporaryRoots.push(root)
    expect(() => createApplicationServer({ gateway, staticRoot: root })).toThrow(
      'Production client build is missing',
    )
  })

  it('serves health and the application shell with security headers', async () => {
    await withServer(async (origin) => {
      const health = await fetch(`${origin}/health`)
      expect(health.status).toBe(200)
      expect(await health.json()).toEqual({ ok: true, status: 'healthy' })

      const index = await fetch(origin)
      expect(index.status).toBe(200)
      expect(await index.text()).toContain('CoSource shell')
      expect(index.headers.get('cache-control')).toBe('no-store')
      const csp = index.headers.get('content-security-policy') ?? ''
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).not.toContain("'unsafe-eval'")
      expect(csp).not.toContain("'unsafe-inline'")
      expect(csp).not.toMatch(/script-src[^;]*\*/)
      expect(index.headers.get('x-content-type-options')).toBe('nosniff')
    })
  })

  it('serves the declared SVG favicon for GET and HEAD', async () => {
    await withServer(async (origin) => {
      const get = await rawRequest(origin, '/favicon.svg')
      expect(get).toMatchObject({ status: 200, contentType: 'image/svg+xml' })
      expect(get.body).toContain('<svg')

      const head = await rawRequest(origin, '/favicon.svg', 'HEAD')
      expect(head).toMatchObject({ status: 200, contentType: 'image/svg+xml', body: '' })
    })
  })

  it('serves immutable hashed assets and supports SPA route fallback', async () => {
    await withServer(async (origin) => {
      const asset = await fetch(`${origin}/assets/app-12345678.js`)
      expect(asset.status).toBe(200)
      expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
      expect(await asset.text()).toContain('__cosource')

      const route = await fetch(`${origin}/workspace/goals`)
      expect(route.status).toBe(200)
      expect(route.headers.get('cache-control')).toBe('no-store')
      expect(await route.text()).toContain('CoSource shell')
    })
  })

  it('keeps API routes out of SPA fallback and forwards gateway requests', async () => {
    await withServer(async (origin) => {
      const search = await fetch(`${origin}/api/catalog/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'notebook' }),
      })
      expect(search.status).toBe(200)
      expect(search.headers.get('cache-control')).toBe('no-store')
      expect(await search.json()).toEqual({ ok: true })
      expect(gateway).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/catalog/search', method: 'POST' }),
      )

      const missing = await fetch(`${origin}/api/not-a-route`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      expect(missing.status).toBe(404)
      expect(missing.headers.get('content-type')).toContain('application/json')
      expect(await missing.text()).not.toContain('CoSource shell')
    })
  })

  it('rejects unsupported static methods and traversal attempts', async () => {
    await withServer(async (origin) => {
      expect((await fetch(origin, { method: 'POST' })).status).toBe(405)
      const traversal = await rawRequest(origin, '/%2e%2e%2fsecret.txt')
      expect(traversal).toMatchObject({
        status: 400,
        contentType: 'application/json; charset=utf-8',
        nosniff: 'nosniff',
      })
      expect(traversal.body).toContain('invalid_path')
      expect(traversal.body).not.toContain('CoSource shell')
      expect(gateway).not.toHaveBeenCalled()
    })
  })

  it.each([
    '/api%2Funknown',
    '/api%2funknown',
    '/api%2Fcatalog%2Fsearch',
    '/api%5Cunknown',
    '/api%ZZunknown',
  ])('rejects ambiguous encoded route %s before dispatch', async (path) => {
    await withServer(async (origin) => {
      const response = await rawRequest(origin, path)
      expect(response).toMatchObject({
        status: 400,
        contentType: 'application/json; charset=utf-8',
        nosniff: 'nosniff',
      })
      expect(response.body).toContain('invalid_path')
      expect(response.body).not.toContain('CoSource shell')
      expect(gateway).not.toHaveBeenCalled()
    })
  })

  it('keeps an ordinary unknown API route in the gateway namespace', async () => {
    await withServer(async (origin) => {
      const response = await rawRequest(origin, '/api/not-a-route')
      expect(response.status).toBe(404)
      expect(response.contentType).toBe('application/json; charset=utf-8')
      expect(response.body).not.toContain('CoSource shell')
      expect(gateway).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/not-a-route', method: 'GET' }),
      )
    })
  })

  it('sanitizes unexpected gateway failures', async () => {
    await withServer(async (origin) => {
      const response = await fetch(`${origin}/api/catalog/search`, {
        method: 'POST',
        body: '{}',
      })
      const body = await response.text()
      expect(response.status).toBe(500)
      expect(body).toContain('The request could not be completed')
      expect(body).not.toContain('C:\\private\\profile.json')
      expect(body).not.toContain('stack')
    }, async () => {
      throw new Error('C:\\private\\profile.json stack')
    })
  })
})
