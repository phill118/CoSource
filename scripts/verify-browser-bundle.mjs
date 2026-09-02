import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const forbiddenBrowserValues = [
  'COSOURCE_UCP_AGENT_PROFILE',
  'shopify.dev/ucp/agent-profiles',
  'catalog.shopify.com/api/ucp/mcp',
]

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(path) : [path]
  })
}

for (const file of filesBelow('dist')) {
  const contents = readFileSync(file)
  for (const value of forbiddenBrowserValues) {
    if (contents.includes(Buffer.from(value))) {
      throw new Error(`Server-only provider configuration found in browser output: ${file}`)
    }
  }
}

process.stdout.write('Browser bundle server-configuration check passed.\n')
