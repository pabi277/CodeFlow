/**
 * Detect the common blocking-input APIs used by supported languages.
 * CodeFlow runs programs with all stdin supplied up front, so this lets the UI
 * explain that workflow before a program is started with an empty input.
 */
const INPUT_PATTERNS: Record<string, RegExp> = {
  python: /\binput\s*\(|\bsys\.stdin\.(?:read|readline)\s*\(/,
  javascript: /\b(?:prompt|input|readline)\s*\(|readFileSync\s*\(\s*0\b|\bprocess\.stdin\b/,
  typescript: /\b(?:prompt|input|readline)\s*\(|readFileSync\s*\(\s*0\b|\bprocess\.stdin\b/,
  c: /\b(?:scanf|fscanf|sscanf|fgets|getchar|getline)\s*\(|\bcin\s*>>/,
  cpp: /\b(?:scanf|fscanf|sscanf|fgets|getchar|getline)\s*\(|\bcin\s*>>/,
  java: /\b(?:Scanner|BufferedReader)\b|\.(?:next\w*|readLine)\s*\(/,
  go: /\b(?:fmt\.)?(?:Scan|Fscan)\w*\s*\(|bufio\.NewReader\s*\(/,
  rust: /\b(?:read_line|stdin)\s*\(/,
  ruby: /\bgets\b/,
  php: /\bfgets\s*\(\s*STDIN\b/,
  shell: /(?:^|[;\n])\s*read\b/,
  perl: /<STDIN>|\bwhile\s*\s*\(\s*<\w+\s*>\s*\)/,
  lua: /\bio\.read\s*\(/,
}

export function programNeedsInput(language: string, source: string): boolean {
  return INPUT_PATTERNS[language]?.test(source) ?? false
}

export interface InputPrompt {
  label: string
}

function cleanPrompt(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .trim()
}

function numbered(count: number): InputPrompt[] {
  return Array.from({ length: count }, (_, i) => ({ label: `Input ${i + 1}` }))
}

/**
 * Build a small guided-input plan for the common input APIs. This does not
 * execute code or try to understand every language; it simply lets the UI ask
 * for familiar values one at a time before sending stdin to the runner.
 */
export function inputPrompts(language: string, source: string): InputPrompt[] {
  if (language === 'python') {
    const calls = [...source.matchAll(/\binput\s*\(\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)')?/g)]
    if (calls.length) return calls.map((m, i) => ({ label: cleanPrompt(m[1] || m[2] || `Input ${i + 1}`) }))
  }

  if (language === 'javascript' || language === 'typescript') {
    const calls = [...source.matchAll(/\b(?:prompt|input)\s*\(\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)')?/g)]
    if (calls.length) return calls.map((m, i) => ({ label: cleanPrompt(m[1] || m[2] || `Input ${i + 1}`) }))
    const reads = source.match(/\b(?:readline|readFileSync)\b/g)?.length || 0
    if (reads) return numbered(reads)
  }

  if (language === 'c' || language === 'cpp') {
    const calls = [...source.matchAll(/\b(?:scanf|fscanf)\s*\(\s*"((?:\\.|[^"])*)"/g)]
    if (calls.length) {
      const outputs = [...source.matchAll(/\bprintf\s*\(\s*"((?:\\.|[^"])*)"/g)]
      return calls.map((call, i) => {
        const before = outputs.filter((output) => (output.index ?? 0) < (call.index ?? 0)).pop()
        return { label: cleanPrompt(before?.[1] || `Input ${i + 1}`) }
      })
    }
    const reads = source.match(/\bcin\s*>>|\b(?:fgets|getchar|getline)\s*\(/g)?.length || 0
    if (reads) return numbered(reads)
  }

  if (language === 'java') {
    const reads = source.match(/\.(?:next\w*|readLine)\s*\(/g)?.length || 0
    if (reads) {
      const outputs = [...source.matchAll(/\bSystem\.out\.(?:print|println)\s*\(\s*"((?:\\.|[^"])*)"/g)]
      return numbered(reads).map((prompt, i) => ({ label: cleanPrompt(outputs[i]?.[1] || prompt.label) }))
    }
  }

  if (language === 'go') {
    const reads = source.match(/\b(?:fmt\.)?(?:Scan|Fscan)\w*\s*\(/g)?.length || 0
    if (reads) return numbered(reads)
  }

  if (language === 'rust') {
    const reads = source.match(/\b(?:read_line|stdin)\s*\(/g)?.length || 0
    if (reads) return numbered(reads)
  }

  if (language === 'ruby' && /\bgets\b/.test(source)) return numbered((source.match(/\bgets\b/g) || []).length)
  if (language === 'php' && /\bfgets\s*\(\s*STDIN\b/.test(source)) return numbered((source.match(/\bfgets\s*\(\s*STDIN\b/g) || []).length)
  if (language === 'shell' && /(?:^|[;\n])\s*read\b/.test(source)) return numbered((source.match(/(?:^|[;\n])\s*read\b/g) || []).length)
  if (language === 'lua' && /\bio\.read\s*\(/.test(source)) return numbered((source.match(/\bio\.read\s*\(/g) || []).length)

  return programNeedsInput(language, source) ? numbered(1) : []
}
