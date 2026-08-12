// Convert user snippets (`${cursor}`, `$1`) into a CodeMirror snippet template.

export function toCmSnippet(body: string): string {
  return body
    .replace(/\$\{cursor\}/g, '${}')
    .replace(/\$0\b/g, '${}')
}

export function snippetHasStops(body: string): boolean {
  return /\$\{cursor\}|\$\{\d|\$\d|\{\}/.test(toCmSnippet(body)) || /\$\{cursor\}|\$0\b|\$\{?\d/.test(body)
}
