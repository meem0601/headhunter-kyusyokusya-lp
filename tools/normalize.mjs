#!/usr/bin/env node
/**
 * 切り抜き済みの人物写真を「頭の大きさ」基準で揃える。
 * 被写体の頭幅を一定にスケールし、頭の上端から同じ位置に配置した同一サイズのキャンバスに書き出す。
 *   node tools/normalize.mjs
 */
import sharp from 'sharp'
import { copyFile, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'images')
const W = 520          // 書き出しキャンバス幅
const H = 720          // 書き出しキャンバス高さ
const TARGET_HEAD = 268 // 揃える頭幅
const TOP = 26         // 頭の上端から天地までの余白
const PAD = 600        // 切り出し時のはみ出し吸収

function measure(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 25) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  const sh = y1 - y0 + 1
  let head = 0, hx0 = x0, hx1 = x1
  for (let y = y0; y < y0 + sh * 0.22; y++) {
    let lo = w, hi = -1
    for (let x = x0; x <= x1; x++) if (data[(y * w + x) * 4 + 3] > 25) { if (x < lo) lo = x; if (x > hi) hi = x }
    if (hi - lo + 1 > head) { head = hi - lo + 1; hx0 = lo; hx1 = hi }
  }
  return { x0, y0, headWidth: head, headCenter: (hx0 + hx1) / 2 }
}

for (let i = 1; i <= 12; i++) {
  const f = join(DIR, `agent-${i}.webp`)
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const m = measure(data, info.width, info.height)

  const scale = TARGET_HEAD / m.headWidth
  const sw = Math.round(info.width * scale)
  const sh = Math.round(info.height * scale)

  const padded = await sharp(f)
    .resize(sw, sh)
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  const left = Math.round(PAD + m.headCenter * scale - W / 2)
  const top = Math.round(PAD + m.y0 * scale - TOP)

  await sharp(padded)
    .extract({ left, top, width: W, height: H })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(f + '.n')
  await copyFile(f + '.n', f)
  await unlink(f + '.n')

  console.log(`agent-${String(i).padStart(2)}  頭幅 ${m.headWidth} → ${TARGET_HEAD}（×${scale.toFixed(2)}）`)
}
