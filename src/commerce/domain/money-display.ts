import type { Money } from './commerce'

export class MoneyDisplayError extends Error {}

export function currencyFractionDigits(currency: string, locale = 'en-GB'): number {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new MoneyDisplayError('Currency identifier is invalid')
  }

  const supportedCurrencies = Intl.supportedValuesOf('currency')
  if (!supportedCurrencies.includes(currency)) {
    throw new MoneyDisplayError('Currency identifier is not supported by this runtime')
  }

  let formatter: Intl.NumberFormat
  try {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    })
  } catch {
    throw new MoneyDisplayError('Currency formatting is not supported by this runtime')
  }

  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits
  if (typeof fractionDigits !== 'number' || !Number.isInteger(fractionDigits)) {
    throw new MoneyDisplayError('Currency fraction metadata is unavailable')
  }
  return fractionDigits
}

export function formatMoney(money: Money, locale = 'en-GB'): string {
  if (!Number.isSafeInteger(money.minorAmount)) {
    throw new MoneyDisplayError('Money amount must be a safe integer')
  }
  const fractionDigits = currencyFractionDigits(money.currency, locale)
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency', currency: money.currency, currencyDisplay: 'code',
  })
  const majorAmount = money.minorAmount / 10 ** fractionDigits
  return formatter.format(majorAmount).replace(/\u00a0/g, ' ')
}
