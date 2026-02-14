#!/usr/bin/env node

const { existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const e2eDir = join(process.cwd(), 'tests', 'e2e')

if (!existsSync(e2eDir)) {
  console.error('❌ Não existe a pasta tests/e2e neste repositório.')
  console.error('ℹ️ Este projeto hoje possui apenas testes unitários e de integração em tests/.')
  console.error('ℹ️ Use "npm test" ou "npm test -- tests/integration".')
  process.exit(1)
}

const files = readdirSync(e2eDir).filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))

if (files.length === 0) {
  console.error('❌ A pasta tests/e2e existe, mas não contém arquivos *.test.* ou *.spec.*.')
  process.exit(1)
}

const result = spawnSync('npx', ['jest', 'tests/e2e', '--testTimeout=30000'], {
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
