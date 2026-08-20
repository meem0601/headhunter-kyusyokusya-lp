#!/usr/bin/env node
/**
 * LP用の画像を OpenAI GPT Image で生成し、images/ に WebP で保存する。
 *
 *   export OPENAI_API_KEY=...        ← 自分で設定すること（このリポジトリには絶対に書かない）
 *   node tools/gen-image.mjs --preset hero --out images/hero.webp
 *   node tools/gen-image.mjs --prompt "..." --out images/foo.webp --size 1536x1024
 *
 * GPT Image は webp 直出力と背景透過に対応しているため、変換処理は不要。
 * --resize を付けたときだけ sharp を使ってリサイズする。
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const ENDPOINT = 'https://api.openai.com/v1/images/generations'
const DEFAULT_MODEL = 'gpt-image-2'

const PRESETS = {
  // ファーストビューの人物カット（現行 images/img-2.webp の置き換え想定）
  // 青背景のヒーローに重ねるので背景は透過で抜く
  hero: {
    size: '1024x1536',
    background: 'transparent',
    prompt: `Full-body studio portrait of a professional Japanese woman in her late 20s, \
wearing a well-tailored charcoal business suit and black heels, standing confidently, \
turning to look straight at the camera over her shoulder. Cut out on a fully transparent background. \
Soft even studio lighting, sharp focus, photorealistic, commercial recruiting website hero image, \
vertical composition with generous headroom. No text, no logos, no watermark.`,
  },

  // 面談・キャリア相談のイメージカット
  consulting: {
    size: '1536x1024',
    background: 'opaque',
    prompt: `Two Japanese business professionals in a bright modern meeting room, \
a career advisor in a navy suit explaining something to a client across a light wood table, \
natural window light, shallow depth of field, photorealistic, calm and trustworthy mood, \
corporate recruiting website photography. No text, no logos, no watermark.`,
  },

  // 抽象背景（人物なし・テキスト載せ用）
  abstract: {
    size: '1536x1024',
    background: 'opaque',
    prompt: `Abstract geometric background for a corporate landing page, deep royal blue gradient \
with subtle diagonal light streaks and faint grid lines, clean and minimal, \
large empty negative space in the center for overlaying text. No people, no text, no logos.`,
  },
}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]
    if (!key?.startsWith('--')) throw new Error(`引数の形式が不正です: ${key}`)
    args[key.slice(2)] = argv[i + 1]
  }
  return args
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

async function main() {
  const args = parseArgs(process.argv)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    fail('OPENAI_API_KEY が未設定です。\n  export OPENAI_API_KEY="..."  を実行してから再試行してください。')
  }

  const preset = args.preset ? PRESETS[args.preset] : null
  if (args.preset && !preset) {
    fail(`preset "${args.preset}" は存在しません。利用可能: ${Object.keys(PRESETS).join(', ')}`)
  }

  const prompt = args.prompt ?? preset?.prompt
  if (!prompt) fail(`--prompt か --preset を指定してください。preset: ${Object.keys(PRESETS).join(', ')}`)

  const out = args.out
  if (!out) fail('--out で出力先を指定してください（例: images/hero.webp）')

  const model = args.model ?? DEFAULT_MODEL
  const size = args.size ?? preset?.size ?? '1024x1536'
  const background = args.background ?? preset?.background ?? 'opaque'
  const compression = Number(args.compression ?? 82)

  console.log(`モデル: ${model} / サイズ: ${size} / 背景: ${background}`)
  console.log(`プロンプト: ${prompt.replace(/\s+/g, ' ').slice(0, 80)}...`)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
      output_format: 'webp',
      output_compression: compression,
      background,
    }),
  })

  if (!res.ok) fail(`APIエラー ${res.status}: ${await res.text()}`)

  const json = await res.json()
  const b64 = json.data?.[0]?.b64_json
  if (!b64) fail('レスポンスに画像が含まれていません:\n' + JSON.stringify(json, null, 2).slice(0, 2000))

  let buf = Buffer.from(b64, 'base64')

  if (args.resize) {
    const { default: sharp } = await import('sharp').catch(() => {
      fail('--resize には sharp が必要です。tools/ で `npm install` を実行してください。')
    })
    const [w, h] = args.resize.split('x').map(Number)
    buf = await sharp(buf).resize(w, h, { fit: 'inside' }).webp({ quality: compression }).toBuffer()
  }

  const outPath = resolve(process.cwd(), out)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, buf)

  console.log(`保存: ${out}  ${(buf.length / 1024).toFixed(1)}KB`)
  if (json.usage) console.log(`トークン: ${JSON.stringify(json.usage)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
