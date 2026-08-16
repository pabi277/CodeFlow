import type { CompletionEntry } from './keywords'

const member = (label: string, detail: string, type: CompletionEntry['type'] = 'member'): CompletionEntry => ({
  label, type, detail, origin: 'language',
})
const methods = (names: string, detail: string): CompletionEntry[] => names.split(/\s+/).map((name) => member(name, detail, 'function'))
const properties = (names: string, detail: string): CompletionEntry[] => names.split(/\s+/).map((name) => member(name, detail))

const JS_ARRAY = methods('at concat copyWithin entries every fill filter find findIndex findLast flat flatMap forEach includes indexOf join keys lastIndexOf map pop push reduce reduceRight reverse shift slice some sort splice toReversed toSorted toSpliced unshift values with', 'Array')
const JS_STRING = methods('at charAt charCodeAt codePointAt concat endsWith includes indexOf lastIndexOf localeCompare match matchAll normalize padEnd padStart repeat replace replaceAll search slice split startsWith substring toLowerCase toUpperCase trim trimEnd trimStart valueOf', 'String')
const JS_PROMISE = methods('then catch finally', 'Promise')
const JS_MAP = [...methods('clear delete entries forEach get has keys set values', 'Map'), ...properties('size', 'Map')]
const JS_SET = [...methods('add clear delete entries forEach has keys values', 'Set'), ...properties('size', 'Set')]
const JS_CONSOLE = methods('assert clear count debug dir error group groupEnd info log table time timeEnd trace warn', 'console')
const JS_MATH = [...methods('abs ceil floor max min pow random round sign sqrt trunc', 'Math'), ...properties('E PI', 'Math')]
const JS_JSON = methods('parse stringify', 'JSON')
const JS_DATE = methods('getDate getDay getFullYear getHours getMilliseconds getMinutes getMonth getSeconds getTime setDate setFullYear setHours setMinutes setMonth setSeconds toISOString toJSON toLocaleDateString toLocaleString toString', 'Date')

const PY_LIST = methods('append clear copy count extend index insert pop remove reverse sort', 'list')
const PY_DICT = methods('clear copy fromkeys get items keys pop popitem setdefault update values', 'dict')
const PY_SET = methods('add clear copy difference discard intersection isdisjoint issubset issuperset pop remove symmetric_difference union update', 'set')
const PY_STR = methods('capitalize casefold center count encode endswith expandtabs find format index isalnum isalpha isdigit islower isspace istitle isupper join ljust lower lstrip partition replace rfind rindex rjust rpartition rsplit rstrip split splitlines startswith strip swapcase title translate upper zfill', 'str')
const PY_PATH = methods('absolute chmod cwd exists expanduser glob is_dir is_file iterate joinpath mkdir open read_bytes read_text rename replace resolve rglob rmdir stat touch unlink with_name with_suffix write_bytes write_text', 'pathlib.Path')

const JAVA_STRING = methods('charAt chars compareTo concat contains endsWith equals equalsIgnoreCase format getBytes indexOf isBlank isEmpty lastIndexOf length matches repeat replace replaceAll split startsWith strip substring toCharArray toLowerCase toUpperCase trim valueOf', 'String')
const JAVA_LIST = [...methods('add addAll clear contains get indexOf isEmpty iterator lastIndexOf remove set sort subList toArray', 'List'), ...properties('size', 'Collection')]
const JAVA_MAP = [...methods('clear compute containsKey containsValue entrySet forEach get getOrDefault isEmpty keySet merge put putAll putIfAbsent remove replace values', 'Map'), ...properties('size', 'Map')]
const JAVA_OPTIONAL = methods('empty filter flatMap get ifPresent isEmpty isPresent map of ofNullable orElse orElseGet orElseThrow', 'Optional')

const CPP_VECTOR = [...methods('at back begin capacity clear data emplace emplace_back empty end erase front insert pop_back push_back reserve resize shrink_to_fit', 'std::vector'), ...properties('size', 'std::vector')]
const CPP_STRING = [...methods('append at back begin c_str capacity clear compare data empty end erase find front insert length pop_back push_back replace reserve resize rfind substr', 'std::string'), ...properties('size', 'std::string')]
const CPP_MAP = [...methods('at begin clear contains count empty end erase find insert merge try_emplace', 'std::map'), ...properties('size', 'std::map')]

const RUST_VEC = methods('as_mut_slice as_slice capacity clear contains dedup drain extend first get insert is_empty last len pop push remove reserve resize retain reverse sort split_at swap truncate', 'Vec')
const RUST_OPTION = methods('and and_then as_ref expect filter get_or_insert is_none is_some map map_or ok_or or or_else take unwrap unwrap_or unwrap_or_default', 'Option')
const RUST_RESULT = methods('and and_then as_ref err expect is_err is_ok map map_err ok or or_else unwrap unwrap_err unwrap_or', 'Result')
const RUST_STRING = methods('as_bytes as_str capacity clear contains ends_with find insert is_empty len lines pop push push_str replace reserve split starts_with trim truncate', 'String')

const GO_FMT = methods('Errorf Fprint Fprintf Fprintln Print Printf Println Scan Scanf Scanln Sprint Sprintf Sprintln', 'fmt package')
const GO_STRINGS = methods('Builder Clone Compare Contains ContainsAny ContainsRune Count Cut EqualFold Fields HasPrefix HasSuffix Index Join LastIndex Map NewReader Repeat Replace ReplaceAll Split ToLower ToUpper Trim TrimPrefix TrimSpace TrimSuffix', 'strings package')
const GO_TIME = [...methods('After Date NewTicker NewTimer Now Parse Since Sleep Tick Until', 'time package'), ...properties('Second Millisecond Microsecond Nanosecond Minute Hour', 'time package')]

function declarationType(code: string, receiver: string, language: string): string {
  const id = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (language === 'javascript' || language === 'typescript') {
    const init = code.match(new RegExp(`\\b(?:const|let|var)\\s+${id}(?:\\s*:[^=]+)?\\s*=\\s*([^;\\n]+)`))?.[1]?.trim() || ''
    const annotation = code.match(new RegExp(`\\b(?:const|let|var)\\s+${id}\\s*:\\s*([A-Za-z_$][\\w$]*)`))?.[1]
    if (annotation) return annotation
    if (init.startsWith('[')) return 'Array'
    if (init.startsWith('{')) return 'Object'
    if (/^["'`]/.test(init)) return 'String'
    return init.match(/new\s+([A-Za-z_$][\w$]*)/)?.[1] || ''
  }
  if (language === 'python') {
    const init = code.match(new RegExp(`^\\s*${id}\\s*(?::\\s*([^=\\n]+))?=\\s*([^\\n]+)`, 'm'))
    const annotation = init?.[1]?.trim()
    if (annotation) return annotation.replace(/\[.*$/, '')
    const value = init?.[2]?.trim() || ''
    if (value.startsWith('[')) return 'list'
    if (value.startsWith('{')) return value === '{}' || value.includes(':') ? 'dict' : 'set'
    if (/^["']/.test(value)) return 'str'
    return value.match(/([A-Za-z_]\w*)\s*\(/)?.[1] || ''
  }
  if (language === 'java' || language === 'cpp') {
    return code.match(new RegExp(`\\b([A-Za-z_]\\w*(?:<[^>]+>)?)\\s+[*&]*\\s*${id}\\b`))?.[1]?.replace(/<.*$/, '') || ''
  }
  if (language === 'rust') {
    return code.match(new RegExp(`\\blet\\s+(?:mut\\s+)?${id}\\s*:\\s*([A-Za-z_]\\w*)`))?.[1]
      || code.match(new RegExp(`\\blet\\s+(?:mut\\s+)?${id}\\s*=\\s*([A-Za-z_]\\w*)`))?.[1]
      || ''
  }
  return ''
}

function cStructFields(code: string, receiver: string): CompletionEntry[] {
  const id = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const type = code.match(new RegExp(`\\bstruct\\s+([A-Za-z_]\\w*)\\s+[*]*\\s*${id}\\b`))?.[1]
    || code.match(new RegExp(`\\b([A-Za-z_]\\w*)\\s+[*]+\\s*${id}\\b`))?.[1]
  if (!type) return []
  const body = code.match(new RegExp(`(?:typedef\\s+)?struct\\s+${type}\\s*\\{([\\s\\S]*?)\\}`, 'm'))?.[1]
    || code.match(new RegExp(`typedef\\s+struct(?:\\s+[A-Za-z_]\\w*)?\\s*\\{([\\s\\S]*?)\\}\\s*${type}\\s*;`, 'm'))?.[1]
  if (!body) return []
  const result: CompletionEntry[] = []
  for (const declaration of body.split(';')) {
    const hit = declaration.trim().match(/(?:[A-Za-z_]\w*\s+)+[*]*\s*([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?$/)
    if (hit) result.push(member(hit[1], `field of struct ${type}`))
  }
  return result
}

export function memberCompletions(language: string, receiver: string, code: string): CompletionEntry[] {
  const base = receiver.split('.').at(-1) || receiver
  const lower = base.toLowerCase()
  const type = declarationType(code, base, language).toLowerCase()

  if (language === 'javascript' || language === 'typescript') {
    if (base === 'console') return JS_CONSOLE
    if (base === 'Math') return JS_MATH
    if (base === 'JSON') return JS_JSON
    if (type === 'array') return JS_ARRAY
    if (type === 'string') return JS_STRING
    if (type === 'promise') return JS_PROMISE
    if (type === 'map') return JS_MAP
    if (type === 'set') return JS_SET
    if (type === 'date') return JS_DATE
    return [...JS_ARRAY, ...JS_STRING, ...JS_PROMISE]
  }
  if (language === 'python') {
    if (type === 'list') return PY_LIST
    if (type === 'dict') return PY_DICT
    if (type === 'set') return PY_SET
    if (type === 'str') return PY_STR
    if (type === 'path' || type === 'pathlib.path') return PY_PATH
    return [...PY_LIST, ...PY_DICT, ...PY_STR]
  }
  if (language === 'java') {
    if (type === 'string') return JAVA_STRING
    if (type === 'list' || type === 'arraylist') return JAVA_LIST
    if (type === 'map' || type === 'hashmap') return JAVA_MAP
    if (type === 'optional') return JAVA_OPTIONAL
    if (base === 'System') return properties('out err in', 'System')
    if (base === 'Math') return JS_MATH
    return [...JAVA_STRING, ...JAVA_LIST, ...JAVA_MAP]
  }
  if (language === 'cpp') {
    if (type === 'vector') return CPP_VECTOR
    if (type === 'string') return CPP_STRING
    if (type === 'map' || type === 'unordered_map') return CPP_MAP
    return [...CPP_VECTOR, ...CPP_STRING]
  }
  if (language === 'c') return cStructFields(code, base)
  if (language === 'rust') {
    if (type === 'vec') return RUST_VEC
    if (type === 'option') return RUST_OPTION
    if (type === 'result') return RUST_RESULT
    if (type === 'string') return RUST_STRING
    return [...RUST_VEC, ...RUST_OPTION, ...RUST_RESULT, ...RUST_STRING]
  }
  if (language === 'go') {
    if (base === 'fmt') return GO_FMT
    if (base === 'strings') return GO_STRINGS
    if (base === 'time') return GO_TIME
  }
  if (language === 'php') return methods('count current end key next reset', 'PHP value')
  if (lower === 'json') return JS_JSON
  return []
}
