import { z } from 'zod'

export const DEVELOPMENT_SHOPIFY_AGENT_PROFILE =
  'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json'

export const DEFAULT_API_PORT = 8787
export const API_HOST = '127.0.0.1'

const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === 'https:')

export interface ServerCommerceConfiguration {
  agentProfileUrl: string
  apiPort: number
}

export function loadServerCommerceConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): ServerCommerceConfiguration {
  const configuredProfile = environment.COSOURCE_UCP_AGENT_PROFILE
  if (environment.NODE_ENV === 'production' && !configuredProfile) {
    throw new Error('COSOURCE_UCP_AGENT_PROFILE is required in production')
  }

  const agentProfileUrl = httpsUrlSchema.parse(
    configuredProfile ?? DEVELOPMENT_SHOPIFY_AGENT_PROFILE,
  )
  const requestedPort = environment.COSOURCE_API_PORT
    ? Number(environment.COSOURCE_API_PORT)
    : DEFAULT_API_PORT
  if (!Number.isSafeInteger(requestedPort) || requestedPort < 1 || requestedPort > 65_535) {
    throw new Error('COSOURCE_API_PORT must be a valid TCP port')
  }

  return { agentProfileUrl, apiPort: requestedPort }
}
