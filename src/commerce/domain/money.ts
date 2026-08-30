import type { Money } from './commerce'

export function createMoney(minorAmount: number, currency: string): Money {
  if (!Number.isSafeInteger(minorAmount)) {
    throw new TypeError('Money minor amount must be a safe integer')
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError('Money currency must be an uppercase ISO 4217 code')
  }

  return { minorAmount, currency }
}

export function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new TypeError('Cross-currency arithmetic requires an explicit FX source')
  }
}
