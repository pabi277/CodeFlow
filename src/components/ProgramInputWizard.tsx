import { useEffect, useState } from 'react'
import { BottomSheet } from './Shared/BottomSheet'
import { useStore } from '../store/useStore'
import { detectLanguage } from '../utils/language'

/**
 * Collect stdin one answer at a time, using prompts that can be read from the
 * common input calls in the source. The runner still receives ordinary stdin,
 * so this works with Termux and Judge0 as well as the browser runner.
 */
export function ProgramInputWizard() {
  const wizard = useStore((s) => s.inputWizard)
  const nodeMap = useStore((s) => s.nodeMap)
  const setInputWizard = useStore((s) => s.setInputWizard)
  const setStdin = useStore((s) => s.setStdin)
  const setInputPanelOpen = useStore((s) => s.setInputPanelOpen)
  const runCurrentFile = useStore((s) => s.runCurrentFile)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!wizard) {
      setValue('')
      return
    }
    setValue(wizard.values[wizard.index] || '')
  }, [wizard])

  if (!wizard) return null

  const node = nodeMap[wizard.fileId]
  const language = node ? detectLanguage(node.path) : 'plain'
  const numeric = ['c', 'cpp', 'java', 'go', 'rust'].includes(language)
  const lastInput = wizard.index === wizard.prompts.length - 1
  const prompt = wizard.prompts[wizard.index] || `Input ${wizard.index + 1}`

  const submit = () => {
    const values = [...wizard.values]
    values[wizard.index] = value
    if (!lastInput) {
      setInputWizard({ ...wizard, values, index: wizard.index + 1 })
      return
    }

    setStdin(values.join('\n'))
    setInputWizard(null)
    setInputPanelOpen(true)
    void runCurrentFile({ allowEmptyInput: true })
  }

  return (
    <BottomSheet open onClose={() => setInputWizard(null)} title="Program input">
      <form
        onSubmit={(event) => { event.preventDefault(); submit() }}
        className="space-y-4 p-4"
      >
        <div className="text-[12px] text-ink-muted">
          Answer one question at a time. CodeFlow will send these answers to the program in order.
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
            Input {wizard.index + 1} of {wizard.prompts.length}
          </div>
          <div className="whitespace-pre-wrap text-[16px] font-medium text-ink">{prompt}</div>
        </div>
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode={numeric ? 'decimal' : 'text'}
          placeholder={numeric ? 'Type a number' : 'Type your answer'}
          aria-label={prompt}
          className="w-full rounded-xl border border-border/60 bg-input px-4 py-3 text-[16px] text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white active:opacity-80"
        >
          {lastInput ? 'Run program' : 'Next input'}
        </button>
      </form>
    </BottomSheet>
  )
}
