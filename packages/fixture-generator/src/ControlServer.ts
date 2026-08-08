import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'

export const controlServerPort = 43_123

const handleRequest = (
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Node's request type is mutable by definition
  request: IncomingMessage,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Node's response type is mutable by definition
  response: ServerResponse,
  config: unknown,
): void => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Content-Type', 'application/json')
  if (request.method !== 'GET' || request.url !== '/config') {
    response.writeHead(404)
    response.end(JSON.stringify({ error: 'Not found' }))
    return
  }
  response.end(JSON.stringify(config))
}

export const startControlServer = async (config: unknown): Promise<Server> => {
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Node supplies mutable HTTP objects
  const server = createServer((request, response) => {
    handleRequest(request, response, config)
  })
  const { promise, reject, resolve } = Promise.withResolvers<void>()
  server.once('error', reject)
  server.listen(controlServerPort, '127.0.0.1', resolve)
  await promise
  return server
}

export const closeControlServer = async (
  server: Readonly<Server>,
): Promise<void> => {
  const { promise, reject, resolve } = Promise.withResolvers<void>()
  server.close((error) => {
    if (error) {
      reject(error)
      return
    }
    resolve()
  })
  await promise
}
