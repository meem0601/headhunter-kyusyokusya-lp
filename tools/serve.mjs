#!/usr/bin/env node
/** LPのプレビュー用の静的サーバー。node tools/serve.mjs で起動し、http://localhost:8123 で見られる。 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, extname } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 8123)
const INDEX = 'headhunter-kyusyokusha-v4.html'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = resolve(ROOT, '.' + (path === '/' ? '/' + INDEX : path))

  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found: ' + path)
  }
}).listen(PORT, () => console.log(`preview: http://localhost:${PORT}  (root: ${ROOT})`))
