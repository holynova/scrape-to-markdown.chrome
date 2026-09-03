import { copyFile, mkdir } from 'node:fs/promises'

await copyFile('dist/intro.html', 'dist/index.html')
await mkdir('dist/privacy', { recursive: true })
await copyFile('docs/privacy/index.html', 'dist/privacy/index.html')
