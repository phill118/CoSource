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
    })
  })

  it('requires a controlled profile in production', () => {
    expect(() => loadServerCommerceConfiguration({ NODE_ENV: 'production' })).toThrow(
      'COSOURCE_UCP_AGENT_PROFILE is required',
    )
  })

  it('accepts a server-supplied HTTPS profile and bounded port', () => {
    expect(
      loadServerCommerceConfiguration({
        NODE_ENV: 'production',
        COSOURCE_UCP_AGENT_PROFILE: 'https://cosource.example/.well-known/ucp',
        COSOURCE_API_PORT: '9000',
      }),
    ).toEqual({
      agentProfileUrl: 'https://cosource.example/.well-known/ucp',
      apiPort: 9000,
    })
  })
})
