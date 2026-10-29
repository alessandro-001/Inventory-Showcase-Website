import { useCallback, useEffect, useState } from 'react'

interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
}

// Runs `fn` when deps change; ignores results from stale runs. `reload()` re-runs it.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setState(s => ({ ...s, loading: true, error: undefined }))
    fn().then(
      data => live && setState({ data, loading: false }),
      (e: Error) => live && setState(s => ({ ...s, error: e.message, loading: false })),
    )
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { ...state, reload }
}
