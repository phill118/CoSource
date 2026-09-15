export const COSOURCE_UCP_VERSION = '2026-04-08' as const
export const COSOURCE_UCP_PROFILE_PATH = '/.well-known/ucp' as const

export const COSOURCE_UCP_AGENT_PROFILE = {
  ucp: {
    version: COSOURCE_UCP_VERSION,
    services: {
      'dev.ucp.shopping': [
        {
          version: COSOURCE_UCP_VERSION,
          spec: `https://ucp.dev/${COSOURCE_UCP_VERSION}/specification/overview`,
          transport: 'mcp',
          schema: `https://ucp.dev/${COSOURCE_UCP_VERSION}/services/shopping/mcp.openrpc.json`,
        },
      ],
    },
    capabilities: {
      'dev.ucp.shopping.catalog.search': [
        {
          version: COSOURCE_UCP_VERSION,
          spec: `https://ucp.dev/${COSOURCE_UCP_VERSION}/specification/catalog/search`,
          schema: `https://ucp.dev/${COSOURCE_UCP_VERSION}/schemas/shopping/catalog_search.json`,
        },
      ],
      'dev.ucp.shopping.catalog.lookup': [
        {
          version: COSOURCE_UCP_VERSION,
          spec: `https://ucp.dev/${COSOURCE_UCP_VERSION}/specification/catalog/lookup`,
          schema: `https://ucp.dev/${COSOURCE_UCP_VERSION}/schemas/shopping/catalog_lookup.json`,
        },
      ],
      'dev.shopify.catalog.global': [
        {
          version: COSOURCE_UCP_VERSION,
          spec: 'https://shopify.dev/docs/agents/catalog/global-catalog',
          schema: `https://shopify.dev/ucp/schemas/${COSOURCE_UCP_VERSION}/shopify_catalog_global.json`,
          extends: [
            'dev.ucp.shopping.catalog.lookup',
            'dev.ucp.shopping.catalog.search',
          ],
        },
      ],
    },
    payment_handlers: {},
  },
} as const

export const COSOURCE_UCP_AGENT_PROFILE_JSON = JSON.stringify(COSOURCE_UCP_AGENT_PROFILE)
