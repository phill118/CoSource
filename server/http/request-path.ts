export class InvalidRequestPathError extends Error {}

export function canonicalRequestPath(rawUrl: string | undefined): string {
  const encoded = new URL(rawUrl ?? '/', 'http://localhost').pathname
  if (/%(?:2f|5c)/i.test(encoded)) throw new InvalidRequestPathError()

  let decoded: string
  try {
    decoded = decodeURIComponent(encoded)
  } catch {
    throw new InvalidRequestPathError()
  }
  if (
    decoded.includes('%') ||
    decoded.includes('\0') ||
    decoded.includes('\\') ||
    decoded.split('/').includes('..')
  ) {
    throw new InvalidRequestPathError()
  }
  return decoded
}
