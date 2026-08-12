// Exhaustive Judge0 CE language table.
// `id` is the stable Judge0 language_id. Multiple ids can exist per language
// across Judge0 versions; we keep the most broadly supported + current ones.
// See https://ce.judge0.com/languages

export interface Judge0Lang {
  id: number
  name: string
}

export const JUDGE0_LANGUAGES: Judge0Lang[] = [
  { id: 50, name: 'C (GCC 9.2.0)' },
  { id: 54, name: 'C++ (G++ 9.2.0)' },
  { id: 59, name: 'C++ (G++ 7.4.0)' },
  { id: 51, name: 'C# (Mono 6.6.0.161)' },
  { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  { id: 93, name: 'JavaScript (Node.js 18.15.0)' },
  { id: 94, name: 'TypeScript (5.0.3)' },
  { id: 71, name: 'Python (3.8.1)' },
  { id: 92, name: 'Python (3.11.2)' },
  { id: 70, name: 'Python (2.7.17)' },
  { id: 62, name: 'Java (OpenJDK 13.0.1)' },
  { id: 91, name: 'Java (OpenJDK 17.0.6)' },
  { id: 60, name: 'Go (1.13.5)' },
  { id: 73, name: 'Rust (1.40.0)' },
  { id: 72, name: 'Ruby (2.7.0)' },
  { id: 68, name: 'PHP (7.4.1)' },
  { id: 83, name: 'Swift (5.2.3)' },
  { id: 78, name: 'Kotlin (1.3.71)' },
  { id: 82, name: 'SQL (SQLite 3.27.2)' },
  { id: 12, name: 'HTML, CSS, JavaScript' },
  { id: 46, name: 'Bash (5.0.0)' },
  { id: 74, name: 'TypeScript (3.7.4)' },
  { id: 64, name: 'Lua (5.3.5)' },
  { id: 67, name: 'Pascal (FPC 3.0.4)' },
  { id: 65, name: 'OCaml (4.06.1)' },
  { id: 66, name: 'Cython (0.29.14)' },
  { id: 79, name: 'Objective-C (Apple Clang 12.0.0)' },
  { id: 80, name: 'R (4.0.0)' },
  { id: 81, name: 'Scala (2.13.2)' },
  { id: 84, name: 'Visual Basic .NET (vbnc 0.0.0.5943)' },
  { id: 85, name: 'Perl (5.28.1)' },
  { id: 86, name: 'Clojure (1.10.1)' },
  { id: 87, name: 'F# (.NET Core SDK 3.1.202)' },
  { id: 88, name: 'Groovy (3.0.3)' },
  { id: 89, name: 'Multi-file program' },
  { id: 90, name: 'Dart (2.19.2)' },
  { id: 77, name: 'COBOL (GnuCOBOL 2.2)' },
  { id: 43, name: 'Plain Text' },
]

// Look up a Judge0 language by id
export function judge0ById(id: number): Judge0Lang | undefined {
  return JUDGE0_LANGUAGES.find((l) => l.id === id)
}
