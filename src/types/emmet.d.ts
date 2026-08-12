declare module 'emmet' {
  export function extract(text: string, pos?: number): { abbreviation: string; location: number; start: number; end: number } | undefined
  export default function expand(abbr: string, config?: { type?: 'markup' | 'stylesheet' }): string
}
