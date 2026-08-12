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
