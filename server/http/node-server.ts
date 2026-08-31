import { createServer, type IncomingMessage } from 'node:http'
import { createCatalogGateway, MAX_REQUEST_BODY_BYTES } from '../commerce/gateway'
import { loadServerCommerceConfiguration, API_HOST } from '../commerce/configuration'
import { createCatalogProvider } from '../commerce/provider-factory'

class RequestBodyTooLargeError extends Error {}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const declaredLength = Number(request.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    request.resume()
    throw new RequestBodyTooLargeError()
  }

  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let exceeded = false

    request.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      if (size > MAX_REQUEST_BODY_BYTES) {
        exceeded = true
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (exceeded) reject(new RequestBodyTooLargeError())
      else resolve(Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
  })
}

const configuration = loadServerCommerceConfiguration()
const provider = createCatalogProvider(configuration)
const handle = createCatalogGateway(provider)

const server = createServer(async (request, response) => {
  try {
    const result = await handle({
      method: request.method ?? '',
      path: new URL(request.url ?? '/', `http://${API_HOST}`).pathname,
      contentType: request.headers['content-type'],
      body: await readRequestBody(request),
    })
    response.writeHead(result.status, result.headers)
    response.end(result.body)
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError
    response.writeHead(tooLarge ? 413 : 500, {
      'content-type': 'application/json; charset=utf-8',
    })
    response.end(
      JSON.stringify({
        ok: false,
        error: {
          code: tooLarge ? 'request_too_large' : 'internal_error',
          message: tooLarge
            ? 'Request body is too large'
            : 'The request could not be completed',
        },
      }),
    )
  }
})

server.listen(configuration.apiPort, API_HOST, () => {
  process.stdout.write(
    `CoSource commerce gateway listening on http://${API_HOST}:${configuration.apiPort}\n`,
  )
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
