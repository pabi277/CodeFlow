/* Encoding helpers — UTF-8 text (emoji, CJK, accents) and binary byte
 * round-trips through base64, plus stored data-URL payload extraction.
 * Run with: npx tsx scripts/encoding.test.ts
 */
import {
  base64ToBytes,
  base64ToText,
  bytesToBase64,
  dataUrlBase64,
  isBinaryPath,
  isImagePath,
  textToBase64,
} from '../src/utils/binary'

let pass = 0
let fail = 0
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.error(`  ❌ ${msg}`) }
}

function main() {
  console.log('\n[text round-trip]')
  const samples = [
    'Hello 😀 世界 café → ✓',
    '🎉🎊 emoji party 🎊🎉\n',
    'Héllö Wörld — “quotes” ‘single’ 100€ ½ ¾',
    '日本語テキストと中文文本 и русский текст עברית',
    'tab\tseparated\tvalues',
  ]
  for (const s of samples) {
    ok(base64ToText(textToBase64(s)) === s, `round-trips ${JSON.stringify(s)}`)
  }

  console.log('\n[old mojibake path is gone]')
  // The exact failure mode this fixes: atob() output used as text directly.
  const emoji = 'Hello 😀 世界'
  ok(atob(textToBase64(emoji)) !== emoji, 'raw atob output is mojibake (sanity check)')
  ok(base64ToText(textToBase64(emoji)) === emoji, 'base64ToText restores emoji and CJK')

  console.log('\n[lone surrogates]')
  // textToBase64 must not throw where the old encodeURIComponent-based trick did.
  const lone = 'bad\uD800surrogate'
  let threw = false
  try {
    textToBase64(lone)
  } catch {
    threw = true
  }
  ok(!threw, 'textToBase64 tolerates lone surrogates without throwing')

  console.log('\n[binary round-trip]')
  const bytes: number[] = []
  for (let i = 0; i < 256; i++) bytes.push(i)
  const bin = String.fromCharCode(...bytes)
  ok(base64ToBytes(bytesToBase64(bin)) === bin, 'all 256 byte values survive base64 round-trip')
  ok(bytesToBase64(bin) === 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==', 'byte encoding matches a known-good base64 vector')

  console.log('\n[path classification]')
  ok(isImagePath('/img/logo.png'), 'png is an image path')
  ok(isBinaryPath('/fonts/x.woff2'), 'woff2 is a binary path')
  ok(!isBinaryPath('/src/main.py'), 'py is not a binary path')
  ok(!isBinaryPath('/README.md'), 'md is not a binary path')

  console.log('\n[data URL payload]')
  const png = dataUrlBase64('data:image/png;base64,iVBORw0KGgo=')
  ok(!!png && png.mime === 'image/png' && png.data === 'iVBORw0KGgo=', 'extracts mime and payload from data URL')
  ok(dataUrlBase64('data:image/svg+xml;charset=utf-8,%3Csvg%3E') === null, 'rejects non-base64 data URLs')
  ok(dataUrlBase64('plain text') === null, 'rejects plain text')
  ok(dataUrlBase64('') === null, 'rejects empty string')

  console.log('\n[data URL edge cases]')
  const withParams = dataUrlBase64('data:image/png;charset=utf-8;base64,QUJD+/8=')
  ok(!!withParams && withParams.mime === 'image/png;charset=utf-8' && withParams.data === 'QUJD+/8=', 'keeps mime parameters and unpadded payload symbols')
  const longHead = 'data:application/octet-stream;name="a-very-long-parameter-name-that-stretches-the-header-past-eighty-characters-just-to-be-safe";base64,AAECAw=='
  const longHeadRes = dataUrlBase64(longHead)
  ok(!!longHeadRes && longHeadRes.data === 'AAECAw==', 'extracts payload when the header exceeds the old 80-char probe')
  const commaMime = dataUrlBase64('data:foo,bar;base64,baz')
  ok(commaMime === null, 'rejects mime parts containing commas')
  const textLike = dataUrlBase64('data:text/plain;base64,SGVsbG8=')
  ok(!!textLike && textLike.data === 'SGVsbG8=', 'extracts any mime that carries a base64 payload')

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
  process.exit(fail ? 1 : 0)
}
main()
