import type { Completion, CompletionContext } from '@codemirror/autocomplete'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

// ---------------------------------------------------------------------------
// Template completion helper
// ---------------------------------------------------------------------------
// A template string may contain a `$0` marker marking the final cursor position.
// `apply` inserts the text and places the cursor at `$0`.
export function templateCompletion(
  label: string,
  template: string,
  opts: { detail?: string; type?: string; boost?: number } = {},
): Completion {
  const cursorIdx = template.indexOf('$0')
  const apply = (view: EditorView, _c: Completion, from: number, to: number) => {
    const insert = template.replace('$0', '')
    view.dispatch({
      changes: { from, to, insert },
      selection: cursorIdx >= 0
        ? EditorSelection.cursor(from + cursorIdx)
        : EditorSelection.cursor(from + insert.length),
      scrollIntoView: true,
    })
  }
  return {
    label,
    type: opts.type || 'snippet',
    detail: opts.detail,
    apply,
    boost: opts.boost ?? 1.2, // snippets rank above plain keywords
    displayLabel: label,
  }
}

// Simple keyword insertion (whole word, cursor after)
export function wordCompletion(label: string, type = 'keyword'): Completion {
  return { label, type, apply: label }
}

// ---------------------------------------------------------------------------
// Python templates
// ---------------------------------------------------------------------------
export const PYTHON_COMPLETIONS: Completion[] = [
  templateCompletion('if', 'if $0:'),
  templateCompletion('elif', 'elif $0:'),
  templateCompletion('else', 'else:'),
  templateCompletion('for', 'for $0 in :'),
  templateCompletion('while', 'while $0:'),
  templateCompletion('def', 'def $0():'),
  templateCompletion('class', 'class $0:'),
  templateCompletion('import', 'import $0'),
  templateCompletion('from', 'from $0 import '),
  templateCompletion('return', 'return $0'),
  templateCompletion('yield', 'yield $0'),
  templateCompletion('try', 'try:\n    $0\nexcept Exception as e:\n    print(e)'),
  templateCompletion('except', 'except $0:'),
  templateCompletion('finally', 'finally:'),
  templateCompletion('with', 'with $0 as :'),
  templateCompletion('lambda', 'lambda $0:'),
  templateCompletion('raise', 'raise $0'),
  templateCompletion('assert', 'assert $0'),
  templateCompletion('async', 'async $0'),
  templateCompletion('await', 'await $0'),
  wordCompletion('pass'), wordCompletion('break'), wordCompletion('continue'),
  wordCompletion('global', 'keyword'), wordCompletion('nonlocal', 'keyword'),
  wordCompletion('True', 'constant'), wordCompletion('False', 'constant'), wordCompletion('None', 'constant'),
  templateCompletion('print', 'print($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('input', 'input($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('len', 'len($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('range', 'range($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('str', 'str($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('int', 'int($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('float', 'float($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('bool', 'bool($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('list', 'list($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('dict', 'dict($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('set', 'set($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('tuple', 'tuple($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('enumerate', 'enumerate($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('zip', 'zip($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('map', 'map($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('filter', 'filter($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('sorted', 'sorted($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('open', 'open($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('isinstance', 'isinstance($0, )', { detail: 'builtin', type: 'function' }),
  templateCompletion('type', 'type($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('sum', 'sum($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('min', 'min($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('max', 'max($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('abs', 'abs($0)', { detail: 'builtin', type: 'function' }),
  templateCompletion('reversed', 'reversed($0)', { detail: 'builtin', type: 'function' }),
  wordCompletion('self', 'variable'),
]

// ---------------------------------------------------------------------------
// JavaScript / TypeScript templates
// ---------------------------------------------------------------------------
export const JS_COMPLETIONS: Completion[] = [
  templateCompletion('function', 'function $0() {}'),
  templateCompletion('const', 'const $0 = '),
  templateCompletion('let', 'let $0 = '),
  templateCompletion('var', 'var $0 = '),
  templateCompletion('if', 'if ($0) {}'),
  templateCompletion('else', 'else {}'),
  templateCompletion('for', 'for (let i = 0; i < $0; i++) {}'),
  templateCompletion('while', 'while ($0) {}'),
  templateCompletion('return', 'return $0'),
  templateCompletion('class', 'class $0 {}'),
  templateCompletion('extends', 'extends $0'),
  templateCompletion('import', "import $0 from ''"),
  templateCompletion('export', 'export $0'),
  templateCompletion('async', 'async $0'),
  templateCompletion('await', 'await $0'),
  templateCompletion('try', 'try {\n  $0\n} catch (error) {\n  console.error(error);\n}'),
  templateCompletion('catch', 'catch (error) {\n  $0\n}'),
  templateCompletion('finally', 'finally {\n  $0\n}'),
  templateCompletion('switch', 'switch ($0) {}'),
  templateCompletion('case', 'case $0:'),
  templateCompletion('arrow', '($0) => {}', { detail: 'arrow function', type: 'snippet' }),
  templateCompletion('arrow function', '($0) => {}', { type: 'snippet' }),
  templateCompletion('template literal', '`$0`', { type: 'snippet' }),
  templateCompletion('destructure', 'const { $0 } = ', { type: 'snippet' }),
  templateCompletion('spread', '...$0', { type: 'operator' }),
  templateCompletion('console.log', 'console.log($0)', { detail: 'Console', type: 'method', boost: 1.5 }),
  templateCompletion('console.error', 'console.error($0)', { detail: 'Console', type: 'method' }),
  templateCompletion('console.warn', 'console.warn($0)', { detail: 'Console', type: 'method' }),
  templateCompletion('setTimeout', 'setTimeout(() => {}, $0)', { detail: 'Timers', type: 'function' }),
  templateCompletion('setInterval', 'setInterval(() => {}, $0)', { detail: 'Timers', type: 'function' }),
  templateCompletion('fetch', "fetch('$0')", { detail: 'Fetch API', type: 'function' }),
  templateCompletion('JSON.parse', 'JSON.parse($0)', { type: 'method' }),
  templateCompletion('JSON.stringify', 'JSON.stringify($0)', { type: 'method' }),
  templateCompletion('Math.floor', 'Math.floor($0)', { type: 'method' }),
  templateCompletion('Math.ceil', 'Math.ceil($0)', { type: 'method' }),
  templateCompletion('Math.round', 'Math.round($0)', { type: 'method' }),
  templateCompletion('Math.max', 'Math.max($0)', { type: 'method' }),
  templateCompletion('Math.min', 'Math.min($0)', { type: 'method' }),
  templateCompletion('Math.random', 'Math.random()', { type: 'method' }),
  templateCompletion('parseInt', 'parseInt($0)', { type: 'function' }),
  templateCompletion('parseFloat', 'parseFloat($0)', { type: 'function' }),
  templateCompletion('Array.from', 'Array.from($0)', { type: 'method' }),
  templateCompletion('Object.keys', 'Object.keys($0)', { type: 'method' }),
  templateCompletion('Object.values', 'Object.values($0)', { type: 'method' }),
  wordCompletion('typeof', 'keyword'), wordCompletion('instanceof', 'keyword'),
  wordCompletion('new', 'keyword'), wordCompletion('this', 'variable'),
  wordCompletion('null', 'constant'), wordCompletion('undefined', 'constant'),
  wordCompletion('true', 'constant'), wordCompletion('false', 'constant'),
  wordCompletion('super', 'keyword'), wordCompletion('void', 'keyword'), wordCompletion('yield', 'keyword'),
]

// ---------------------------------------------------------------------------
// C templates (ISO C — no C++ iostream / class / namespace)
// ---------------------------------------------------------------------------
export const C_COMPLETIONS: Completion[] = [
  wordCompletion('int', 'keyword'), wordCompletion('float', 'keyword'), wordCompletion('double', 'keyword'),
  wordCompletion('char', 'keyword'), wordCompletion('void', 'keyword'), wordCompletion('bool', 'keyword'),
  wordCompletion('size_t', 'type'), wordCompletion('const', 'keyword'), wordCompletion('static', 'keyword'),
  wordCompletion('extern', 'keyword'), wordCompletion('unsigned', 'keyword'), wordCompletion('signed', 'keyword'),
  wordCompletion('long', 'keyword'), wordCompletion('short', 'keyword'), wordCompletion('restrict', 'keyword'),
  wordCompletion('volatile', 'keyword'), wordCompletion('inline', 'keyword'),
  wordCompletion('break', 'keyword'), wordCompletion('continue', 'keyword'), wordCompletion('goto', 'keyword'),
  templateCompletion('if', 'if ($0) {\n  \n}'),
  templateCompletion('else', 'else {\n  $0\n}'),
  templateCompletion('else if', 'else if ($0) {\n  \n}'),
  templateCompletion('for', 'for (int i = 0; i < $0; i++) {\n  \n}'),
  templateCompletion('while', 'while ($0) {\n  \n}'),
  templateCompletion('do', 'do {\n  $0\n} while (0);'),
  templateCompletion('switch', 'switch ($0) {\n  case 0:\n    break;\n  default:\n    break;\n}'),
  templateCompletion('case', 'case $0:\n  break;'),
  templateCompletion('return', 'return $0;'),
  templateCompletion('struct', 'struct $0 {\n  \n};'),
  templateCompletion('typedef', 'typedef $0;'),
  templateCompletion('typedef struct', 'typedef struct $0 {\n  \n} $0;'),
  templateCompletion('enum', 'enum $0 {\n  \n};'),
  templateCompletion('union', 'union $0 {\n  \n};'),
  templateCompletion('printf', 'printf("$0\\n");', { detail: 'stdio.h', type: 'function' }),
  templateCompletion('scanf', 'scanf("%d", &$0);', { detail: 'stdio.h', type: 'function' }),
  templateCompletion('fprintf', 'fprintf(stderr, "$0\\n");', { detail: 'stdio.h', type: 'function' }),
  templateCompletion('snprintf', 'snprintf($0, sizeof(), "");', { detail: 'stdio.h', type: 'function' }),
  templateCompletion('malloc', 'malloc(sizeof($0));', { detail: 'stdlib.h', type: 'function' }),
  templateCompletion('calloc', 'calloc($0, sizeof());', { detail: 'stdlib.h', type: 'function' }),
  templateCompletion('realloc', 'realloc($0, );', { detail: 'stdlib.h', type: 'function' }),
  templateCompletion('free', 'free($0);', { detail: 'stdlib.h', type: 'function' }),
  templateCompletion('sizeof', 'sizeof($0)', { type: 'operator' }),
  templateCompletion('include', '#include <$0>', { type: 'preprocessor' }),
  templateCompletion('include quote', '#include "$0"', { type: 'preprocessor' }),
  templateCompletion('define', '#define $0 ', { type: 'preprocessor' }),
  templateCompletion('ifdef', '#ifdef $0\n#endif', { type: 'preprocessor' }),
  templateCompletion('ifndef', '#ifndef $0\n#define $0\n\n#endif', { type: 'preprocessor' }),
  templateCompletion('main', 'int main(void) {\n  $0\n  return 0;\n}', { type: 'snippet' }),
  templateCompletion('main args', 'int main(int argc, char *argv[]) {\n  $0\n  return 0;\n}', { type: 'snippet' }),
  wordCompletion('NULL', 'constant'), wordCompletion('true', 'constant'), wordCompletion('false', 'constant'),
  wordCompletion('EOF', 'constant'), wordCompletion('nullptr', 'constant'),
  templateCompletion('fori', 'for (size_t i = 0; i < $0; i++) {\n  \n}', { detail: 'index loop', type: 'snippet' }),
]

// ---------------------------------------------------------------------------
// C++ templates
// ---------------------------------------------------------------------------
export const CPP_COMPLETIONS: Completion[] = [
  wordCompletion('int', 'keyword'), wordCompletion('float', 'keyword'), wordCompletion('double', 'keyword'),
  wordCompletion('char', 'keyword'), wordCompletion('void', 'keyword'), wordCompletion('bool', 'keyword'),
  wordCompletion('const', 'keyword'), wordCompletion('static', 'keyword'), wordCompletion('extern', 'keyword'),
  templateCompletion('if', 'if ($0) {}'),
  templateCompletion('else', 'else {}'),
  templateCompletion('for', 'for (int i = 0; i < $0; i++) {}'),
  templateCompletion('while', 'while ($0) {}'),
  templateCompletion('do', 'do {\n  $0\n} while ();'),
  templateCompletion('switch', 'switch ($0) {}'),
  templateCompletion('case', 'case $0:'),
  templateCompletion('return', 'return $0'),
  templateCompletion('struct', 'struct $0 {};'),
  templateCompletion('typedef', 'typedef $0'),
  templateCompletion('enum', 'enum $0 {};'),
  templateCompletion('printf', 'printf("$0");', { detail: 'stdio', type: 'function' }),
  templateCompletion('scanf', 'scanf("%d", &$0);', { detail: 'stdio', type: 'function' }),
  templateCompletion('malloc', 'malloc(sizeof($0))', { detail: 'stdlib', type: 'function' }),
  templateCompletion('free', 'free($0)', { detail: 'stdlib', type: 'function' }),
  templateCompletion('sizeof', 'sizeof($0)', { type: 'operator' }),
  templateCompletion('include', '#include <$0>', { type: 'preprocessor' }),
  templateCompletion('define', '#define $0 ', { type: 'preprocessor' }),
  templateCompletion('main', 'int main() {\n  $0\n  return 0;\n}', { type: 'snippet' }),
  wordCompletion('nullptr', 'constant'), wordCompletion('true', 'constant'), wordCompletion('false', 'constant'),
  templateCompletion('cout', 'cout << $0;', { detail: 'C++ iostream' }),
  templateCompletion('cin', 'cin >> $0;', { detail: 'C++ iostream' }),
  wordCompletion('endl', 'constant'),
  wordCompletion('string', 'keyword'), wordCompletion('auto', 'keyword'),
  templateCompletion('vector', 'vector<$0>()', { type: 'type' }),
  templateCompletion('class', 'class $0 {};', { type: 'keyword' }),
  wordCompletion('public', 'keyword'), wordCompletion('private', 'keyword'), wordCompletion('protected', 'keyword'),
  wordCompletion('namespace', 'keyword'), wordCompletion('template', 'keyword'),
]

// ---------------------------------------------------------------------------
// Java templates
// ---------------------------------------------------------------------------
export const JAVA_COMPLETIONS: Completion[] = [
  wordCompletion('public', 'keyword'), wordCompletion('private', 'keyword'), wordCompletion('protected', 'keyword'),
  wordCompletion('static', 'keyword'), wordCompletion('final', 'keyword'), wordCompletion('abstract', 'keyword'),
  wordCompletion('void', 'keyword'), wordCompletion('int', 'keyword'), wordCompletion('double', 'keyword'),
  wordCompletion('float', 'keyword'), wordCompletion('boolean', 'keyword'), wordCompletion('char', 'keyword'),
  wordCompletion('long', 'keyword'),
  templateCompletion('class', 'class $0 {}', { type: 'keyword' }),
  templateCompletion('interface', 'interface $0 {}'),
  templateCompletion('extends', 'extends $0'),
  templateCompletion('implements', 'implements $0'),
  wordCompletion('new', 'keyword'), wordCompletion('this', 'variable'), wordCompletion('super', 'keyword'),
  templateCompletion('if', 'if ($0) {}'),
  templateCompletion('else', 'else {}'),
  templateCompletion('for', 'for (int i = 0; i < $0; i++) {}'),
  templateCompletion('while', 'while ($0) {}'),
  templateCompletion('do', 'do {\n  $0\n} while ();'),
  templateCompletion('switch', 'switch ($0) {}'),
  templateCompletion('case', 'case $0:'),
  templateCompletion('return', 'return $0'),
  templateCompletion('try', 'try {\n  $0\n} catch (Exception e) {\n  e.printStackTrace();\n}'),
  templateCompletion('catch', 'catch (Exception e) {\n  $0\n}'),
  templateCompletion('finally', 'finally {\n  $0\n}'),
  templateCompletion('throw', 'throw $0'),
  templateCompletion('throws', 'throws $0'),
  templateCompletion('import', 'import $0'),
  templateCompletion('package', 'package $0'),
  templateCompletion('System.out.println', 'System.out.println($0);', { detail: 'Java API', type: 'method', boost: 1.5 }),
  templateCompletion('System.out.print', 'System.out.print($0);', { detail: 'Java API', type: 'method' }),
  templateCompletion('ArrayList', 'ArrayList<$0>()', { type: 'type' }),
  templateCompletion('HashMap', 'HashMap<$0, >()', { type: 'type' }),
  templateCompletion('Scanner', 'Scanner sc = new Scanner(System.in);', { type: 'type', boost: 1.3 }),
  templateCompletion('main method', 'public static void main(String[] args) {\n  $0\n}', { type: 'snippet' }),
  templateCompletion('override', '@Override', { type: 'annotation' }),
  wordCompletion('null', 'constant'), wordCompletion('true', 'constant'), wordCompletion('false', 'constant'),
  wordCompletion('instanceof', 'keyword'),
  templateCompletion('enum', 'enum $0 {}'),
  templateCompletion('List', 'List<$0>', { type: 'type' }),
  templateCompletion('Map', 'Map<$0, >', { type: 'type' }),
  templateCompletion('Set', 'Set<$0>', { type: 'type' }),
]

// Map language -> template completions (rich quick-fill)
export const TEMPLATE_COMPLETIONS_BY_LANG: Record<string, Completion[]> = {
  python: PYTHON_COMPLETIONS,
  javascript: JS_COMPLETIONS,
  typescript: JS_COMPLETIONS,
  c: C_COMPLETIONS,
  cpp: CPP_COMPLETIONS,
  java: JAVA_COMPLETIONS,
}

// ---------------------------------------------------------------------------
// Symbol pair suggestions (appear when typing a trigger char)
// ---------------------------------------------------------------------------
export function symbolPairCompletion(context: CompletionContext): Completion[] | null {
  const before = context.matchBefore(/[({["'`]/)
  if (!before) return null
  const char = before.text
  const pairs: Record<string, string[]> = {
    '(': ['($0)', '( $0 )'],
    '{': ['{$0}', '{\n  $0\n}'],
    '[': ['[$0]', '[ $0 ]'],
    '"': ['"$0"'],
    "'": ["'$0'"],
    '`': ['`$0`', '`${$0}`'],
  }
  const set = pairs[char]
  if (!set) return null
  return set.map((tpl) => templateCompletion(tpl.replace('$0', ''), tpl, { type: 'snippet', detail: 'pair', boost: 2 }))
}
