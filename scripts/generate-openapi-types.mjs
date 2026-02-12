import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const input = process.env.OPENAPI_JSON_PATH ?? 'openapi/openapi.json'
const output = process.env.OPENAPI_TYPES_PATH ?? 'openapi/zera-api.d.ts'

if (!existsSync(input)) {
  throw new Error(`Missing ${input}. Run "npm run openapi:export" first.`)
}

await mkdir('openapi', { recursive: true })
execSync(`npx openapi-typescript ${input} -o ${output}`, { stdio: 'inherit' })
console.log(`Types generated at ${output}`)
