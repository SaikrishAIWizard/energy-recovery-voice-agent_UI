import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, Database, Eye, RefreshCw, Search, ShieldCheck, Table2, X } from 'lucide-react'
import { api } from '../api/client'
import type { DatabaseRow, DatabaseRows, DatabaseTable, DatabaseValue } from '../lib/types'

const DESCRIPTIONS: Record<string, string> = {
  leads: 'Lead contact details, recovery status and last completed step.',
  call_sessions: 'Call states, consent disclosure, timing and provider references.',
  journey_fields: 'Captured answers, validation status, confidence and attempts.',
  transcript_segments: 'Stored customer and agent turns, including redaction flags.',
  handoffs: 'Escalation reasons, collected context and human acceptance.',
  audit_events: 'The recorded decisions and events behind each call.',
  journey_submissions: 'Mock submission receipts and their stored JSON payloads.',
}

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-500 disabled:cursor-not-allowed disabled:opacity-40'

function fullValue(value: DatabaseValue): string {
  if (value === null) return 'NULL'
  if (typeof value !== 'string') return String(value)
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed !== null && typeof parsed === 'object') return JSON.stringify(parsed, null, 2)
  } catch {
    // Plain database text is rendered verbatim, never as HTML.
  }
  return value === '' ? '(empty string)' : value
}

export function DatabasePage() {
  const [tables, setTables] = useState<DatabaseTable[]>([])
  const [tableName, setTableName] = useState('leads')
  const [data, setData] = useState<DatabaseRows | null>(null)
  const [indexLoading, setIndexLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(25)
  const [offset, setOffset] = useState(0)
  const [sortBy, setSortBy] = useState<string | undefined>()
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [refresh, setRefresh] = useState(0)
  const [selectedRow, setSelectedRow] = useState<DatabaseRow | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIndexLoading(true)
    setIndexError(null)
    api.databaseTables(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setTables(result.tables) })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setIndexError(err instanceof Error ? err.message : 'Could not load tables.')
      })
      .finally(() => { if (!controller.signal.aborted) setIndexLoading(false) })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setData(null)
    setSelectedRow(null)
    api.databaseRows(tableName, { limit, offset, q: query, sort_by: sortBy, direction }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        // A call reset or concurrent deletion can shrink the last page.
        if (offset > 0 && offset >= result.matched) {
          setOffset(Math.max(0, Math.ceil(result.matched / limit) - 1) * limit)
          return
        }
        setData(result)
        setUpdatedAt(new Date().toLocaleTimeString())
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load rows.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tableName, limit, offset, query, sortBy, direction, refresh])

  const table = tables.find((item) => item.name === tableName)
  const columns = table?.columns ?? []
  const matched = data?.matched ?? 0
  const total = data?.total ?? table?.row_count ?? 0
  const page = Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(matched / limit))

  function selectTable(name: string) {
    setTableName(name)
    setDraft('')
    setQuery('')
    setOffset(0)
    setSortBy(undefined)
    setDirection('asc')
    setSelectedRow(null)
  }

  function sortColumn(name: string) {
    const active = (sortBy ?? columns.find((column) => column.primary_key)?.name) === name
    setSortBy(name)
    setDirection(active && direction === 'asc' ? 'desc' : 'asc')
    setOffset(0)
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-navy-50 p-2.5 text-navy-800"><Database className="h-6 w-6" aria-hidden /></span>
            <div>
              <h1 className="text-xl font-semibold text-navy-900">Database explorer</h1>
              <p className="text-xs text-slate-500">Energy Recovery / Internal tools</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />Read only</span>
            <Link to="/" className={buttonClass}><ArrowLeft className="h-4 w-4" aria-hidden />Back to console</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-5 py-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Unlisted local-demo page. Hidden does not mean password-protected: records may contain contact details and transcripts. Keep the backend local. This viewer cannot edit, delete or run SQL.
        </div>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-navy-900">Application tables</h2>
              <span className="text-xs text-slate-500">{tables.length || '—'}</span>
            </div>
            {indexLoading && tables.length === 0 && <p role="status" className="p-4 text-sm text-slate-500">Loading tables…</p>}
            {indexError && <p role="alert" className="p-4 text-xs text-red-700">{indexError} Use Refresh to retry.</p>}
            <nav aria-label="Database tables" className="space-y-1 p-2">
              {tables.map((item) => (
                <button key={item.name} type="button" onClick={() => selectTable(item.name)} aria-current={tableName === item.name ? 'page' : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs transition ${tableName === item.name ? 'bg-navy-50 font-semibold text-navy-900 ring-1 ring-inset ring-navy-200' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <Table2 className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 break-all font-mono">{item.name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{(item.name === tableName && data ? data.total : item.row_count).toLocaleString()}</span>
                </button>
              ))}
            </nav>
            <p className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-500">Counts update on refresh. Select a table, then inspect a row for its complete values.</p>
          </aside>

          <section className="min-w-0 space-y-4" aria-label="Table contents">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <h2 className="font-mono text-lg font-semibold text-navy-900">{tableName}</h2>
                  <p className="mt-1 text-sm text-slate-500">{DESCRIPTIONS[tableName]}</p>
                  <p className="mt-2 text-xs text-slate-500">{total.toLocaleString()} rows · {columns.length} columns{updatedAt && ` · Last loaded ${updatedAt}`}</p>
                </div>
                <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading || indexLoading} className={buttonClass}>
                  <RefreshCw className={`h-4 w-4 ${loading || indexLoading ? 'animate-spin' : ''}`} aria-hidden />Refresh
                </button>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
                <form className="flex min-w-0 flex-1 flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); setOffset(0); setRefresh((value) => value + 1) }}>
                  <label className="min-w-[180px] max-w-md flex-1 text-xs font-medium text-slate-600">
                    Search all columns
                    <input type="search" value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} placeholder="Lead ID, call ID, status, text…"
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-navy-500 focus:outline-none" />
                  </label>
                  <button type="submit" disabled={loading} className={buttonClass}><Search className="h-4 w-4" aria-hidden />Search</button>
                  {query && <button type="button" className={buttonClass} onClick={() => { setDraft(''); setQuery(''); setOffset(0) }}>Clear</button>}
                </form>
                <label className="text-xs font-medium text-slate-600">Rows per page
                  <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setOffset(0) }} className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                    {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
              </div>

              {error && <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} If you just added this page, restart the backend and use Refresh.</div>}
              {loading ? <p role="status" className="py-16 text-center text-sm text-slate-500">Loading rows…</p> : !error && data && (
                <>
                  <div className="max-h-[520px] overflow-auto" tabIndex={0} role="region" aria-label={`${tableName} data grid`}>
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <caption className="sr-only">{tableName} records. Column headers sort the table; Inspect opens full row values.</caption>
                      <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr>
                          <th scope="col" className="border-b border-slate-200 px-4 py-3 font-medium text-slate-500">Details</th>
                          {columns.map((column) => (
                            <th key={column.name} scope="col" aria-sort={data.sort_by === column.name ? (data.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="whitespace-nowrap border-b border-slate-200 px-4 py-3">
                              <button type="button" onClick={() => sortColumn(column.name)} className="flex items-center gap-1.5 font-mono font-semibold text-navy-900 hover:underline">
                                {column.name}{column.primary_key && <span className="text-[10px] text-amber-700">PK</span>}
                                {data.sort_by === column.name && (data.direction === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
                              </button>
                              <span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">{column.type}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.rows.map((row, index) => (
                          <tr key={columns.filter((column) => column.primary_key).map((column) => String(row[column.name])).join(':') || index} className={selectedRow === row ? 'bg-navy-50' : 'hover:bg-slate-50'}>
                            <td className="px-4 py-3 align-top">
                              <button type="button" onClick={() => setSelectedRow(row)} aria-label={`Inspect row ${offset + index + 1}`} aria-pressed={selectedRow === row} className="inline-flex items-center gap-1.5 rounded px-1 py-1 font-medium text-navy-700 hover:bg-navy-100"><Eye className="h-3.5 w-3.5" aria-hidden />Inspect</button>
                            </td>
                            {columns.map((column) => {
                              const value = row[column.name]
                              return <td key={column.name} className="max-w-[300px] px-4 py-3 align-top font-mono text-slate-700">
                                {value === null ? <span className="italic text-slate-400">NULL</span> : <span className="block min-w-[80px] truncate">{value === '' ? <span className="italic text-slate-400">(empty)</span> : String(value)}</span>}
                              </td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.rows.length === 0 && <div className="px-5 py-14 text-center"><Database className="mx-auto mb-3 h-7 w-7 text-slate-300" aria-hidden /><p className="text-sm font-medium text-slate-600">{query ? 'No matching rows' : 'This table is empty'}</p><p className="mt-1 text-xs text-slate-400">{query ? 'Try another search or clear the filter.' : 'Run a demo call from the console, then refresh here.'}</p></div>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                    <p role="status" className="text-xs text-slate-500">{matched ? `${offset + 1}–${Math.min(offset + limit, matched)}` : '0'} of {matched.toLocaleString()} {query ? `matching rows (${total.toLocaleString()} total)` : 'rows'}</p>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label="Previous page" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className={buttonClass}><ChevronLeft className="h-4 w-4" aria-hidden /></button>
                      <span className="text-xs text-slate-500">Page {page} of {pageCount}</span>
                      <button type="button" aria-label="Next page" disabled={offset + limit >= matched} onClick={() => setOffset(offset + limit)} className={buttonClass}><ChevronRight className="h-4 w-4" aria-hidden /></button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {selectedRow && <section className="rounded-xl border border-navy-200 bg-white p-4 shadow-card" aria-label="Full row details">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-navy-900">Full row details</h3><button type="button" onClick={() => setSelectedRow(null)} className={buttonClass} aria-label="Close row details"><X className="h-4 w-4" aria-hidden /></button></div>
              <dl className="divide-y divide-slate-100">{columns.map((column) => <div key={column.name} className="grid gap-2 py-3 sm:grid-cols-[200px_minmax(0,1fr)]"><dt className="break-all font-mono text-xs text-slate-500">{column.name}</dt><dd><pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800">{fullValue(selectedRow[column.name])}</pre></dd></div>)}</dl>
            </section>}

            {table && <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-navy-900">Table schema · {columns.length} columns</summary>
              <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr className="border-b border-slate-200 text-slate-500">{['Column', 'Type', 'Nullable', 'Key / reference'].map((label) => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>{columns.map((column) => <tr key={column.name} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2 font-mono">{column.name}</td><td className="px-3 py-2 font-mono text-slate-500">{column.type}</td><td className="px-3 py-2">{column.nullable ? 'Yes' : 'No'}</td><td className="px-3 py-2 font-mono">{column.primary_key ? 'Primary key' : column.references.join(', ') || '—'}</td></tr>)}</tbody></table></div>
            </details>}
          </section>
        </div>
      </main>
    </div>
  )
}
