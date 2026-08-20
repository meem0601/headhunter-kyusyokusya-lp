#!/usr/bin/env node
/**
 * 白背景の人物写真から背景を抜いて、透過WebPを書き出す。
 * 端から連結している「白」だけを消すので、白いシャツなど内側の白は残る。
 *   node tools/cutout.mjs
 */
import sharp from 'sharp'
import { readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'images')
/* 引数でソース画像のパスを渡せる。省略時は images/ の既存写真を使う */
const ARGS = process.argv.slice(2)
const SOURCES = ARGS.length ? ARGS : ['img-5', 'img-6', 'img-7', 'img-8', 'img-9', 'img-10', 'img-11', 'img-12']
const WHITE = Number(process.env.WHITE ?? 249) // これ以上明るければ背景候補
const OFFSET = Number(process.env.INDEX_OFFSET ?? 0) // 出力番号の開始位置をずらす
const MAX_H = 760 // 書き出し時の最大高さ

async function cutout(name, index) {
  const src = name.includes('/') ? name : join(DIR, name + '.webp')
  const { data, info } = await sharp(src)
    .resize({ height: MAX_H, withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const n = w * h

  const isWhite = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    if (r >= WHITE && g >= WHITE && b >= WHITE) isWhite[i] = 1
  }

  // 外周から連結する白だけを塗りつぶす
  const bg = new Uint8Array(n)
  const queue = new Int32Array(n)
  let head = 0, tail = 0
  const push = (i) => { if (!bg[i] && isWhite[i]) { bg[i] = 1; queue[tail++] = i } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (head < tail) {
    const i = queue[head++]
    const x = i % w, y = (i / w) | 0
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (y > 0) push(i - w)
    if (y < h - 1) push(i + w)
  }

  // アルファを作り、3x3 の平均でふちをなめらかに
  const a0 = new Uint8Array(n)
  for (let i = 0; i < n; i++) a0[i] = bg[i] ? 0 : 255
  const a1 = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          sum += a0[yy * w + xx]; cnt++
        }
      }
      a1[y * w + x] = (sum / cnt) | 0
    }
  }
  for (let i = 0; i < n; i++) data[i * 4 + 3] = a1[i]

  const out = join(DIR, `agent-${index}.webp`)
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(out)

  const removed = bg.reduce((s, v) => s + v, 0)
  console.log(`${name.split('/').pop()} → agent-${index}.webp  ${w}x${h}  背景除去 ${(removed / n * 100).toFixed(1)}%`)
}

for (const [i, name] of SOURCES.entries()) await cutout(name, i + 1 + OFFSET)
