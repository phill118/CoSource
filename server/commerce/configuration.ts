import { z } from 'zod'
import { COSOURCE_UCP_PROFILE_PATH } from './agent-profile'

export const DEVELOPMENT_SHOPIFY_AGENT_PROFILE =
  'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json'

export const DEFAULT_API_PORT = 8787
export const DEVELOPMENT_API_HOST = '127.0.0.1'
export const PRODUCTION_API_HOST = '0.0.0.0'

const httpsUrlSchema = z
  .url()
  .max(4_096)
  .transform((value, context) => {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) {
      context.addIssue({ code: 'custom', message: 'URL must use HTTPS without credentials' })
      return z.NEVER
    }
    return url
  })

export interface ServerCommerceConfiguration {
  agentProfileUrl: string
  apiPort: number
  apiHost: string
}

export function loadServerCommerceConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): ServerCommerceConfiguration {
  const configuredProfile = environment.COSOURCE_UCP_AGENT_PROFILE
  const renderExternalUrl = environment.RENDER_EXTERNAL_URL
  let agentProfileUrl: string
  if (configuredProfile) {
    agentProfileUrl = httpsUrlSchema.parse(configuredProfile).href
  } else if (renderExternalUrl) {
    const renderOrigin = httpsUrlSchema.parse(renderExternalUrl).origin
    agentProfileUrl = new URL(COSOURCE_UCP_PROFILE_PATH, renderOrigin).href
  } else if (environment.NODE_ENV === 'production') {
    throw new Error(
      'COSOURCE_UCP_AGENT_PROFILE or RENDER_EXTERNAL_URL is required in production',
    )
  } else {
    agentProfileUrl = DEVELOPMENT_SHOPIFY_AGENT_PROFILE
  }
  const requestedPort = environment.PORT
    ? Number(environment.PORT)
    : environment.COSOURCE_API_PORT
      ? Number(environment.COSOURCE_API_PORT)
    : DEFAULT_API_PORT
  if (!Number.isSafeInteger(requestedPort) || requestedPort < 1 || requestedPort > 65_535) {
    throw new Error('PORT must be a valid TCP port')
  }

  return {
    agentProfileUrl,
    apiPort: requestedPort,
    apiHost: environment.NODE_ENV === 'production' ? PRODUCTION_API_HOST : DEVELOPMENT_API_HOST,
  }
}
