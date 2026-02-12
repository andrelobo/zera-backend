import { mkdir, writeFile } from 'node:fs/promises'

const baseUrl = process.env.OPENAPI_BASE_URL ?? 'http://127.0.0.1:3000'
const output = process.env.OPENAPI_JSON_PATH ?? 'openapi/openapi.json'
const url = `${baseUrl.replace(/\/$/, '')}/docs-json`

const response = await fetch(url)
if (!response.ok) {
  throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
}

const content = await response.text()
await mkdir('openapi', { recursive: true })
await writeFile(output, content, 'utf8')
console.log(`OpenAPI exported to ${output}`)
