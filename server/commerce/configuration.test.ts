import { describe, expect, it } from 'vitest'
import {
  DEVELOPMENT_SHOPIFY_AGENT_PROFILE,
  loadServerCommerceConfiguration,
} from './configuration'

describe('server-only commerce configuration', () => {
  it('uses the live-verified Shopify profile only as a development fallback', () => {
    expect(loadServerCommerceConfiguration({ NODE_ENV: 'development' })).toEqual({
      agentProfileUrl: DEVELOPMENT_SHOPIFY_AGENT_PROFILE,
      apiPort: 8787,
      apiHost: '127.0.0.1',
    })
  })

  it('requires a controlled profile in production', () => {
    expect(() => loadServerCommerceConfiguration({ NODE_ENV: 'production' })).toThrow(
      'COSOURCE_UCP_AGENT_PROFILE or RENDER_EXTERNAL_URL is required',
    )
  })

  it('accepts a server-supplied HTTPS profile and bounded port', () => {
    expect(
      loadServerCommerceConfiguration({
        NODE_ENV: 'production',
        COSOURCE_UCP_AGENT_PROFILE: 'https://cosource.example/.well-known/ucp',
        PORT: '9000',
      }),
    ).toEqual({
      agentProfileUrl: 'https://cosource.example/.well-known/ucp',
      apiPort: 9000,
      apiHost: '0.0.0.0',
    })
  })

  it('derives the self-hosted profile from the parsed Render origin', () => {
    expect(
      loadServerCommerceConfiguration({
        NODE_ENV: 'production',
        RENDER_EXTERNAL_URL: 'https://cosource.onrender.com/hostile/path?ignored=yes#ignored',
      }),
    ).toMatchObject({
      agentProfileUrl: 'https://cosource.onrender.com/.well-known/ucp',
      apiHost: '0.0.0.0',
    })
  })

  it('gives the explicit profile precedence over the Render origin', () => {
    expect(
      loadServerCommerceConfiguration({
        NODE_ENV: 'production',
        COSOURCE_UCP_AGENT_PROFILE: 'https://profiles.cosource.example/platform.json',
        RENDER_EXTERNAL_URL: 'https://cosource.onrender.com',
      }).agentProfileUrl,
    ).toBe('https://profiles.cosource.example/platform.json')
  })

  it.each([
    ['COSOURCE_UCP_AGENT_PROFILE', 'http://cosource.example/.well-known/ucp'],
    ['COSOURCE_UCP_AGENT_PROFILE', 'https://user:password@cosource.example/.well-known/ucp'],
    ['COSOURCE_UCP_AGENT_PROFILE', 'not a URL'],
    ['RENDER_EXTERNAL_URL', 'http://cosource.onrender.com'],
    ['RENDER_EXTERNAL_URL', 'https://user:password@cosource.onrender.com/path'],
    ['RENDER_EXTERNAL_URL', 'not a URL'],
  ])('rejects unsafe %s value', (name, value) => {
    expect(() =>
      loadServerCommerceConfiguration({ NODE_ENV: 'production', [name]: value }),
    ).toThrow()
  })

  it('prefers the hosting PORT while preserving the legacy development override', () => {
    expect(loadServerCommerceConfiguration({PORT:'8123',COSOURCE_API_PORT:'9000'})).toMatchObject({apiPort:8123,apiHost:'127.0.0.1'})
    expect(loadServerCommerceConfiguration({COSOURCE_API_PORT:'9000'})).toMatchObject({apiPort:9000})
  })

  it.each(['0','65536','not-a-port'])('rejects unsafe hosting port %s',PORT=>{
    expect(()=>loadServerCommerceConfiguration({PORT})).toThrow('PORT must be a valid TCP port')
  })
})
