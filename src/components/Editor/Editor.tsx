import { useEffect, useRef } from 'react'
import { EditorState, Compartment, EditorSelection } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  hoverTooltip,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { multiCursorExtensions } from '../../editor/multiCursor'
import { expandEmmetInEditor } from '../../editor/emmetExpand'
import { indentGuides } from '../../editor/indentGuides'
import { rainbowBrackets } from '../../editor/rainbowBrackets'
import { linkedEditing } from '../../editor/linkedEditing'
import { formatOnPaste } from '../../editor/pasteIndent'
import { indentOnInput, bracketMatching, foldGutter, foldKeymap, indentUnit } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, acceptCompletion } from '@codemirror/autocomplete'
import { searchKeymap, search } from '@codemirror/search'
import { linter, lintGutter, forceLinting, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import { getCompletionSourceForLanguage } from '../../editor/completions/index'
import { setProjectIndex } from '../../editor/completions/projectIndex'
import { extractLocalSymbols } from '../../editor/completions/localSymbols'
import { useStore } from '../../store/useStore'
import { detectLanguage } from '../../utils/language'
import { detectIndent } from '../../utils/detectIndent'
import { editorConfigForProject } from '../../utils/editorConfig'
import { isBinaryPath, isDataUrl, isImagePath } from '../../utils/binary'
import { wordAt } from '../../utils/symbolNav'
import { loadLanguageExtension } from '../../editor/editorLanguages'
import { BinaryPreview } from './BinaryPreview'
import { editorExtensionsForPalette } from '../../editor/themes'
import { resolvePalette } from '../../utils/theme'
import { FONT_FAMILIES } from '../../config/defaults'
import { registerEditor, goToPosition } from '../../utils/editorApi'
import { debounce } from '../../utils/debounce'
import { VscCode } from 'react-icons/vsc'
import { Minimap } from './Minimap'
import { StickyScroll } from './StickyScroll'

export function Editor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langComp = useRef(new Compartment())
  const themeComp = useRef(new Compartment())
  const lineNumComp = useRef(new Compartment())
  const wrapComp = useRef(new Compartment())
  const fontComp = useRef(new Compartment())
  const indentComp = useRef(new Compartment())
  const cursorShapeComp = useRef(new Compartment())
  const bracketComp = useRef(new Compartment())
  const completionComp = useRef(new Compartment())
  const lintComp = useRef(new Compartment())
  const guidesComp = useRef(new Compartment())
  const rainbowComp = useRef(new Compartment())
  const linkedComp = useRef(new Compartment())
  const pasteComp = useRef(new Compartment())
  const drawSelComp = useRef(new Compartment())

  const activeTabId = useStore((s) => s.activeTabId)
  const nodeMap = useStore((s) => s.nodeMap)
  const settings = useStore((s) => s.settings)
  const focusEditorRequest = useStore((s) => s.focusEditorRequest)
  const saveContent = useStore((s) => s.saveContent)
  const persistContent = useStore((s) => s.persistContent)
  const diagnostics = useStore((s) => s.diagnostics)
  const persistRef = useRef(persistContent)
  persistRef.current = persistContent
  const debouncedSave = useRef<((id: string) => void) | null>(null)

  // Mount the CodeMirror view once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const saveTimer = debounce((id: string) => persistRef.current(id), settings.autoSaveDelay)
    debouncedSave.current = saveTimer
    const diagTimer = debounce(() => useStore.getState().refreshDiagnostics(), 400)

    const persistPos = debounce(() => {
      const id = activeTabRef.current
      const v = viewRef.current
      if (!id || !v) return
      const pos = v.state.selection.main.head
      const line = v.state.doc.lineAt(pos)
      useStore.getState().saveActiveEditorCursor(id, { line: line.number, col: pos - line.from + 1 })
      useStore.getState().saveActiveEditorScroll(id, v.scrollDOM.scrollTop)
    }, 250)

    const updateListener = EditorView.updateListener.of((update) => {
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      const next = { line: line.number, col: pos - line.from + 1 }
      const prev = useStore.getState().cursorPos
      if (prev.line !== next.line || prev.col !== next.col) useStore.getState().setCursorPos(next)
      if (update.selectionSet || update.viewportChanged) persistPos()
      if (!update.docChanged) return
      const id = activeTabRef.current
      if (!id) return
      const text = update.state.doc.toString()
      saveContent(id, text)
      saveTimer(id)
      diagTimer()
    })

    const lintSource = linter((view) => {
      const id = useStore.getState().activeTabId
      if (!id) return []
      return storeDiagsToCm(view, useStore.getState().diagnostics.filter((d) => d.fileId === id))
    })

    const hover = hoverTooltip((view, pos) => {
      const line = view.state.doc.lineAt(pos)
      const word = wordAt(view.state.doc.toString(), line.number, pos - line.from + 1)
      if (!word) return null
      const store = useStore.getState()
      const id = store.activeTabId
      const node = id ? store.nodeMap[id] : undefined
      if (!node) return null
      const lang = detectLanguage(node.path)
      const hit = extractLocalSymbols(node.content, lang).find((s) => s.name === word)
      if (!hit) return null
      return {
        pos,
        above: true,
        create() {
          const dom = document.createElement('div')
          dom.className = 'rounded-md border border-border/60 bg-panel px-2.5 py-1.5 text-[12px] text-ink shadow-lg'
          dom.textContent = `${hit.type} ${hit.name}  ·  line ${hit.line}`
          return { dom }
        },
      }
    })

    const gotoClick = EditorView.domEventHandlers({
      click(event) {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false
        event.preventDefault()
        void useStore.getState().goToDefinition()
        return true
      },
    })

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelComp.current.of(drawSelection()),
          history(),
          indentOnInput(),
          bracketMatching(),
          foldGutter(),
          closeBrackets(),
          hover,
          gotoClick,
          keymap.of([
            {
              key: 'Tab',
              run: (v) => {
                if (acceptCompletion(v)) return true
                const path = activeTabRef.current ? useStore.getState().nodeMap[activeTabRef.current]?.path : ''
                const lang = path ? detectLanguage(path) : 'plain'
                if (['html', 'css', 'scss', 'less', 'xml', 'vue'].includes(lang) && expandEmmetInEditor(v, lang)) return true
                return indentWithTab.run?.(v) ?? false
              },
            },
            // Enter must insert a newline — never accept if/for snippets (that
            // used to expand a block and felt like a new tab after every Enter).
            { key: 'F12', run: () => { void useStore.getState().goToDefinition(); return true } },
            { key: 'Shift-F12', run: () => { void useStore.getState().findReferences(); return true } },
            { key: 'F2', run: () => { useStore.getState().openRename(); return true } },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...completionKeymap.filter((b) => b.key !== 'Enter'),
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
          ]),
          multiCursorExtensions,
          search({ top: false }),
          completionComp.current.of(
            autocompletion({
              override: [getCompletionSourceForLanguage('plain')],
              defaultKeymap: false,
              activateOnTyping: true,
              maxRenderedOptions: 8,
              closeOnBlur: true,
              aboveCursor: true,
            }),
          ),
          langComp.current.of([]),
          themeComp.current.of(editorExtensionsForPalette(resolvePalette(settings.themePreset, settings.customThemes))),
          lineNumComp.current.of([]),
          wrapComp.current.of([]),
          fontComp.current.of([]),
          indentComp.current.of([]),
          cursorShapeComp.current.of([]),
          bracketComp.current.of([]),
          guidesComp.current.of([]),
          rainbowComp.current.of([]),
          linkedComp.current.of([]),
          pasteComp.current.of([]),
          lintComp.current.of([lintGutter(), lintSource]),
          updateListener,
        ],
      }),
    })
    viewRef.current = view
    registerEditor(view)
    return () => {
      registerEditor(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Focus the editor when a new file is auto-opened (focusEditorRequest bumps)
  const lastFocusReq = useRef(focusEditorRequest)
  useEffect(() => {
    if (focusEditorRequest !== lastFocusReq.current) {
      lastFocusReq.current = focusEditorRequest
      const view = viewRef.current
      if (view) {
        view.focus()
        view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true })
      }
    }
  }, [focusEditorRequest])

  // Track active file id for the change listener
  const activeTabRef = useRef(activeTabId)
  activeTabRef.current = activeTabId

  // Update document when active tab changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const node = activeTabId ? nodeMap[activeTabId] : undefined
    const content = node?.content || ''
    const current = view.state.doc.toString()
    const pending = useStore.getState().pendingGoTo
    const keepSelection = !!(pending && pending.fileId === activeTabId)
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        ...(keepSelection ? {} : { selection: EditorSelection.cursor(0), scrollIntoView: true }),
      })
    }
    if (pending && pending.fileId === activeTabId) {
      goToPosition(pending.line, pending.col)
      useStore.getState().clearPendingGoTo()
    } else if (activeTabId && current !== content && !keepSelection) {
      const saved = useStore.getState().cursorPositions[activeTabId]
      if (saved) goToPosition(saved.line, saved.col)
      const top = useStore.getState().scrollPositions[activeTabId]
      if (typeof top === 'number') view.scrollDOM.scrollTop = top
    }
  }, [activeTabId, nodeMap])

  // Reconfigure language + completion source when the active file changes
  const activePath = activeTabId ? nodeMap[activeTabId]?.path : undefined
  useEffect(() => {
    let cancelled = false
    const lang = activePath ? detectLanguage(activePath) : 'plain'
    const files = Object.values(nodeMap)
      .filter((n) => n.type === 'file')
      .map((n) => ({ path: n.path, name: n.name }))
    setProjectIndex(activePath || '', files)
    loadLanguageExtension(lang).then((ext) => {
      const view = viewRef.current
      if (cancelled || !view) return
      view.dispatch({ effects: langComp.current.reconfigure(ext) })
    })
    const view = viewRef.current
    if (view) {
      view.dispatch({
        effects: completionComp.current.reconfigure(
          autocompletion({
            override: [getCompletionSourceForLanguage(lang)],
            defaultKeymap: false,
            activateOnTyping: true,
            maxRenderedOptions: 8,
            closeOnBlur: true,
            aboveCursor: true,
          }),
        ),
      })
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath])

  // Reconfigure settings-derived extensions
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: themeComp.current.reconfigure(editorExtensionsForPalette(resolvePalette(settings.themePreset, settings.customThemes))) })
    view.dispatch({ effects: lineNumComp.current.reconfigure(settings.showLineNumbers ? lineNumbers() : []) })
    view.dispatch({ effects: wrapComp.current.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []) })
    const fontFamily = FONT_FAMILIES[settings.fontFamily] || FONT_FAMILIES['system-monospace']
    view.dispatch({
      effects: fontComp.current.reconfigure(
        EditorView.theme({ '&': { fontSize: `${settings.fontSize}px` }, '.cm-scroller': { fontFamily } }),
      ),
    })

    let tabSize = settings.tabSize
    let spaces = settings.indentWithSpaces
    if (settings.autoDetectIndent && activeTabId) {
      const guessed = detectIndent(nodeMap[activeTabId]?.content || '')
      if (guessed) {
        tabSize = guessed.tabSize
        spaces = guessed.indentWithSpaces
      }
    }
    if (activePath) {
      const fromEc = editorConfigForProject(Object.values(nodeMap), activePath)
      if (fromEc.tabSize) tabSize = fromEc.tabSize
      if (fromEc.indentWithSpaces !== undefined) spaces = fromEc.indentWithSpaces
    }
    const tabSizeExt = spaces ? indentUnit.of(' '.repeat(tabSize)) : EditorState.tabSize.of(tabSize)
    view.dispatch({ effects: indentComp.current.reconfigure(tabSizeExt) })

    const cursorShape = settings.cursorStyle === 'block' ? 'block' : settings.cursorStyle === 'underline' ? 'underline' : 'line'
    view.dispatch({
      effects: cursorShapeComp.current.reconfigure(
        EditorView.theme({
          '&': { cursorShape } as Record<string, string>,
          '.cm-cursor, .cm-dropCursor': settings.smoothCursor
            ? { transition: 'left 80ms ease, top 80ms ease' }
            : {},
        }),
      ),
    })
    view.dispatch({
      effects: drawSelComp.current.reconfigure(drawSelection({ cursorBlinkRate: settings.smoothCursor ? 1200 : 530 })),
    })
    view.dispatch({ effects: bracketComp.current.reconfigure(settings.bracketMatching ? bracketMatching() : []) })
    view.dispatch({ effects: guidesComp.current.reconfigure(settings.indentGuides ? indentGuides() : []) })
    view.dispatch({ effects: rainbowComp.current.reconfigure(settings.rainbowBrackets ? rainbowBrackets() : []) })
    const lang = activePath ? detectLanguage(activePath) : 'plain'
    view.dispatch({ effects: linkedComp.current.reconfigure(['html', 'xml', 'vue'].includes(lang) ? linkedEditing() : []) })
    view.dispatch({ effects: pasteComp.current.reconfigure(settings.formatOnPaste ? formatOnPaste() : []) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.themePreset, settings.customThemes, settings.showLineNumbers, settings.wordWrap, settings.fontSize,
    settings.fontFamily, settings.tabSize, settings.indentWithSpaces, settings.cursorStyle, settings.smoothCursor,
    settings.bracketMatching, settings.indentGuides, settings.rainbowBrackets, settings.formatOnPaste,
    settings.autoDetectIndent, activePath, activeTabId,
  ])

  // Refresh gutter lints when diagnostics change
  useEffect(() => {
    const view = viewRef.current
    if (view) forceLinting(view)
  }, [diagnostics, activeTabId])

  const node = activeTabId ? nodeMap[activeTabId] : undefined
  const hasFile = !!node
  const binary = !!(node && (isImagePath(node.path) || isBinaryPath(node.path) || isDataUrl(node.content)))

  return (
    <div className="relative flex h-full w-full">
      <div ref={containerRef} className={`h-full min-w-0 flex-1 overflow-hidden bg-transparent ${binary ? 'hidden' : ''}`} />
      {binary && node && <div className="h-full min-w-0 flex-1"><BinaryPreview path={node.path} content={node.content} /></div>}
      <StickyScroll />
      {hasFile && settings.showMinimap && <Minimap />}
      {!hasFile && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <VscCode className="text-5xl text-ink-muted" />
          <h2 className="text-lg font-semibold text-ink">Welcome to CodeFlow</h2>
          <p className="max-w-xs text-sm text-ink-muted">Open a file from the explorer, or create a new one to start coding. Tap ▶ to run the active file.</p>
        </div>
      )}
    </div>
  )
}

function storeDiagsToCm(view: EditorView, diags: { line: number; col: number; severity: string; message: string }[]): CmDiagnostic[] {
  return diags.map((d) => {
    const lineNo = Math.min(Math.max(1, d.line), view.state.doc.lines)
    const line = view.state.doc.line(lineNo)
    const from = Math.min(line.from + Math.max(0, d.col - 1), line.to)
    const to = Math.min(from + 1, line.to) || line.from
    const severity: CmDiagnostic['severity'] = d.severity === 'warning' ? 'warning' : d.severity === 'info' ? 'info' : 'error'
    return { from, to: Math.max(from, to), severity, message: d.message }
  })
}
