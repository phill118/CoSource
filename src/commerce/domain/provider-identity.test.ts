import { describe, expect, it } from 'vitest'
import type { CommerceProviderId, ProviderIdentity } from './commerce'
import { findByProviderIdentity, providerIdentityKey, sameProviderIdentity } from './provider-identity'

const provider = (value: string) => value as CommerceProviderId
const identity = (source: string, id: string): ProviderIdentity => ({ provider: provider(source), id })

describe('provider-scoped identity', () => {
  it('treats the same provider and ID as equal', () => expect(sameProviderIdentity(identity('a', 'shared'), identity('a', 'shared'))).toBe(true))
  it('does not treat equal ID strings from different providers as equal', () => {
    const a = identity('provider-a', 'shared'), b = identity('provider-b', 'shared')
    expect(sameProviderIdentity(a, b)).toBe(false)
    expect(providerIdentityKey(a)).not.toBe(providerIdentityKey(b))
  })
  it('finds the provider-correct product for comparison selection', () => {
    const items = [{ identity: identity('provider-a', 'shared'), name: 'A' }, { identity: identity('provider-b', 'shared'), name: 'B' }]
    expect(findByProviderIdentity(items, identity('provider-b', 'shared'))?.name).toBe('B')
  })
  it('uses an unambiguous structured key', () => {
    expect(providerIdentityKey(identity('a:b', 'c'))).not.toBe(providerIdentityKey(identity('a', 'b:c')))
  })
})
