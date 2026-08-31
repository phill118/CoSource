import type { CatalogProvider } from '../../src/commerce/providers/catalog-provider'
import { ShopifyGlobalCatalogProvider } from '../../src/commerce/providers/shopify-global/shopify-global-catalog-provider'
import type { ServerCommerceConfiguration } from './configuration'

export function createCatalogProvider(
  configuration: ServerCommerceConfiguration,
): CatalogProvider {
  return new ShopifyGlobalCatalogProvider({
    agentProfileUrl: configuration.agentProfileUrl,
  })
}
