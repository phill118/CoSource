import type { ProductCluster } from '../commerce/domain/commerce'
import { providerIdentityKey } from '../commerce/domain/provider-identity'

export type ProductEvidenceRegistry = ReadonlyMap<string, ProductCluster>

export function retainProductEvidence(registry: ProductEvidenceRegistry, product: ProductCluster): ProductEvidenceRegistry {
  const key = providerIdentityKey(product.identity)
  if (registry.get(key) === product) return registry
  const next = new Map(registry); next.set(key, product); return next
}

export function refreshRetainedProductEvidence(registry: ProductEvidenceRegistry, products: ProductCluster[]): ProductEvidenceRegistry {
  let next: Map<string, ProductCluster> | undefined
  for (const product of products) {
    const key = providerIdentityKey(product.identity)
    if (registry.has(key) && registry.get(key) !== product) {
      next ??= new Map(registry); next.set(key, product)
    }
  }
  return next ?? registry
}

export function productEvidenceValues(registry: ProductEvidenceRegistry): ProductCluster[] {
  return [...registry.values()]
}
