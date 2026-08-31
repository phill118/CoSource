import type { ProviderIdentity } from './commerce'

export function sameProviderIdentity(a: ProviderIdentity, b: ProviderIdentity): boolean {
  return a.provider === b.provider && a.id === b.id
}

export function providerIdentityKey(identity: ProviderIdentity): string {
  return JSON.stringify([identity.provider, identity.id])
}

export function findByProviderIdentity<T extends { identity: ProviderIdentity }>(items: T[], identity: ProviderIdentity): T | undefined {
  return items.find((item) => sameProviderIdentity(item.identity, identity))
}
