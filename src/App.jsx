import { useCallback, useEffect, useState } from 'react'
import './App.css'

const tellerApiUrl = import.meta.env.VITE_API_URL
const drawApiUrl = import.meta.env.VITE_DRAW_API_URL
const drawIds = (import.meta.env.VITE_DRAW_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
const overallApiUrl = import.meta.env.VITE_OVERALL_API_URL
const supervisorApiUrl = import.meta.env.VITE_SUPERVISOR_API_URL
const authorization = import.meta.env.VITE_AUTHORIZATION

function getCurrentDate() {
  return formatDate(new Date())
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function getNextDate(dateValue) {
  const nextDate = new Date(`${dateValue}T00:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  return formatDate(nextDate)
}

const defaultFromDate = getCurrentDate()

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return [{ value: payload }]

  const collection = payload.data ?? payload.results ?? payload.items ?? payload.rows
  if (Array.isArray(collection)) return collection
  return [payload]
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount)
}

function formatAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 }).format(amount)
}

function formatDrawTime(value) {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?$/)
  if (!match) return formatValue(value)

  const hour = Number(match[1])
  const minutes = match[2] ?? '00'
  if (hour < 0 || hour > 23) return formatValue(value)

  const period = hour >= 12 ? 'PM' : 'AM'
  const twelveHour = hour % 12 || 12
  return `${twelveHour}:${minutes} ${period}`
}

function formatReportValue(value, column) {
  return column === 'drawTime' ? formatDrawTime(value) : formatValue(value)
}

function Icon({ name, size = 18 }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    reports: <><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /><path d="M3 20h18" /></>,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
    money: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 9h.01M17 15h.01" /></>,
    fields: <><path d="M7 5h10M7 12h10M7 19h10" /><circle cx="4" cy="5" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="19" r="1" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-3L3 11" /><path d="M3 5v6h6" /><path d="M4 13a8 8 0 0 0 14.7 3L21 13" /><path d="M21 19v-6h-6" /></>,
  }
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function getColumns(rows) {
  const columns = []
  rows.forEach((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      Object.keys(row).forEach((key) => {
        if (!columns.includes(key)) columns.push(key)
      })
    }
  })
  return columns
}

const agentFieldNames = ['agentName', 'agent_name', 'agent', 'AgentName', 'agentCode', 'fullName', 'username']
const supervisorFieldNames = ['supervisorUsername', 'supervisorName', 'supervisor_name', 'SupervisorName', 'supervisorCode', 'supervisor', 'name']
const drawGroups = [
  { key: 'morning', label: '1st Draw', schedule: '10:30 AM + 2:00 PM', times: ['10:30 AM', '2:00 PM'] },
  { key: 'afternoon', label: '2nd Draw', schedule: '3:00 PM + 5:00 PM', times: ['3:00 PM', '5:00 PM'] },
  { key: 'evening', label: '3rd Draw', schedule: '7:00 PM + 9:00 PM', times: ['7:00 PM', '9:00 PM'] },
]

function getFirstField(row, fieldNames) {
  const fieldName = fieldNames.find((name) => row?.[name] !== undefined && row[name] !== null && row[name] !== '')
  return fieldName ? row[fieldName] : null
}

function getSupervisorReports(rows, supervisorRows = []) {
  const supervisorNames = new Map(supervisorRows.map((row) => [String(row.username), row.fullName]))
  const supervisorNamesById = new Map(supervisorRows.map((row) => [String(row.id), row.fullName]))
  const grouped = new Map()
  rows.forEach((row) => {
    const supervisorUsername = String(row.supervisorUsername ?? '')
    const supervisor = formatValue(supervisorNamesById.get(String(row.supervisor)) ?? supervisorNames.get(supervisorUsername) ?? getFirstField(row, supervisorFieldNames)).toUpperCase()
    const gross = Number(row.TotalOverAllGross) || 0
    const hits = Number(row.TotalOverAllHits) || 0
    const teller = formatValue(row.fullName ?? row.username)
    const tellerKey = formatValue(row.username ?? row.fullName ?? teller)
    const current = grouped.get(supervisor) ?? { supervisor, agents: new Map(), totalGross: 0, totalHits: 0 }
    const drawTime = formatDrawTime(row.drawTime)
    const agent = current.agents.get(tellerKey) ?? { key: tellerKey, teller, draws: new Map(), totalGross: 0, totalHits: 0 }
    const draw = agent.draws.get(drawTime) ?? { gross: 0, hits: 0 }
    draw.gross += gross
    draw.hits += hits
    agent.draws.set(drawTime, draw)
    agent.totalGross += gross
    agent.totalHits += hits
    current.agents.set(tellerKey, agent)
    current.totalGross += gross
    current.totalHits += hits
    grouped.set(supervisor, current)
  })

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    agents: Array.from(group.agents.values()).map((agent) => ({ ...agent, totalNet: agent.totalGross - agent.totalHits, totalSalary: agent.totalGross * 0.1, totalKabig: (agent.totalGross - agent.totalHits) - (agent.totalGross * 0.1) })),
    totalNet: group.totalGross - group.totalHits,
    totalSalary: group.totalGross * 0.1,
    totalKabig: (group.totalGross - group.totalHits) - (group.totalGross * 0.1),
  }))
}

function getGroupedDrawTotal(agent, group, field) {
  return group.times.reduce((total, time) => total + (agent.draws.get(time)?.[field] ?? 0), 0)
}

function getCarryoverTotal(agent) {
  const firstDrawNet = getGroupedDrawTotal(agent, drawGroups[0], 'gross') - getGroupedDrawTotal(agent, drawGroups[0], 'hits')
  const secondDrawGross = getGroupedDrawTotal(agent, drawGroups[1], 'gross')
  return Math.max(firstDrawNet, 0) + secondDrawGross
}

function getGroupedNet(agent, group) {
  const gross = getGroupedDrawTotal(agent, group, 'gross')
  const hits = getGroupedDrawTotal(agent, group, 'hits')
  if (group.key === 'afternoon') return getCarryoverTotal(agent) - hits
  if (group.key === 'evening') return getThirdDrawCarryover(agent) - hits
  return gross - hits
}

function getSupervisorCarryoverTotal(group) {
  return group.agents.reduce((total, agent) => total + getCarryoverTotal(agent), 0)
}

function getThirdDrawCarryover(agent) {
  return getGroupedNet(agent, drawGroups[1]) + getGroupedDrawTotal(agent, drawGroups[2], 'gross')
}

function getSupervisorThirdDrawCarryover(group) {
  return group.agents.reduce((total, agent) => total + getThirdDrawCarryover(agent), 0)
}

function DrawGrossSummary({ rows }) {
  const totals = drawGroups.map((group) => ({
    ...group,
    gross: rows.reduce((total, row) => {
      const drawTime = formatDrawTime(row.drawTime)
      return group.times.includes(drawTime) ? total + (Number(row.TotalOverAllGross) || 0) : total
    }, 0),
  }))
  const overall = totals.reduce((total, group) => total + group.gross, 0)

  return <section className="draw-summary" aria-label="Total gross per draw summary"><div className="draw-summary-heading"><div><strong>Total gross per draw</strong><span>Source comparison summary</span></div><strong>{formatAmount(overall)} overall</strong></div><div className="draw-summary-grid">{totals.map((group) => <div className={`draw-summary-card draw-${group.key}`} key={group.key}><span>{group.label}</span><small>{group.schedule}</small><strong>{formatAmount(group.gross)}</strong></div>)}</div></section>
}

function MatrixTable({ group }) {
  return (
    <div className="table-wrap">
      <table className="gross-table matrix-table">
        <thead>
          <tr>
            <th className="agent-header" rowSpan="2">Agent</th>
            {drawGroups.map((drawGroup) => <th className={`draw-group-heading draw-${drawGroup.key}`} colSpan={drawGroup.key === 'morning' ? 3 : 4} key={drawGroup.key}><span>{drawGroup.label}</span><small>{drawGroup.schedule}</small></th>)}
            <th className="draw-group-heading draw-commission" rowSpan="2"><span>Commission</span><small>10% of Gross</small></th><th className="draw-group-heading draw-net-sales" rowSpan="2"><span>Net Sales</span><small>3rd Net - Commission</small></th><th className="draw-group-heading draw-overall" colSpan="3"><span>Overall</span><small>All draws</small></th>
          </tr>
          <tr>
            {drawGroups.flatMap((drawGroup) => [
              <th className={`draw-subheading draw-${drawGroup.key}`} key={`${drawGroup.key}-gross`}><span className="draw-header-label">Gross</span></th>,
              <th className={`draw-subheading draw-${drawGroup.key}`} key={`${drawGroup.key}-hits`}><span className="draw-header-label">Hits</span></th>,
              ...(drawGroup.key === 'afternoon' ? [<th className="draw-subheading draw-afternoon carryover-header" key="afternoon-carryover" title="1st Draw Net + 2nd Draw Gross"><small>1st Net + 2nd Gross</small></th>] : []),
              ...(drawGroup.key === 'evening' ? [<th className="draw-subheading draw-evening carryover-header" key="evening-carryover" title="2nd Draw Net + 3rd Draw Gross"><small>2nd Net + 3rd Gross</small></th>] : []),
              <th className={`draw-subheading draw-${drawGroup.key}`} key={`${drawGroup.key}-net`}><span className="draw-header-label">Net</span></th>,
            ])}
            <th className="draw-subheading draw-overall"><span className="draw-header-label">Gross</span></th><th className="draw-subheading draw-overall"><span className="draw-header-label">Hits</span></th><th className="draw-subheading draw-overall"><span className="draw-header-label">Net</span></th>
          </tr>
        </thead>
        <tbody>
          {group.agents.map((agent) => <tr key={`${group.supervisor}-${agent.key}`}>
            <td className="agent-name-cell"><strong>{agent.teller}</strong></td>
            {drawGroups.flatMap((drawGroup) => {
              const gross = getGroupedDrawTotal(agent, drawGroup, 'gross')
              const hits = getGroupedDrawTotal(agent, drawGroup, 'hits')
              const net = getGroupedNet(agent, drawGroup)
              const carryover = getCarryoverTotal(agent)
              const thirdCarryover = getThirdDrawCarryover(agent)
              return [
                <td className={`draw-cell draw-${drawGroup.key} ${gross < 0 ? 'negative-value' : ''}`} key={`${agent.key}-${drawGroup.key}-gross`}>{formatAmount(gross)}</td>,
                <td className={`draw-cell draw-${drawGroup.key} ${hits < 0 ? 'negative-value' : ''}`} key={`${agent.key}-${drawGroup.key}-hits`}>{formatAmount(hits)}</td>,
                ...(drawGroup.key === 'afternoon' ? [<td className={`draw-cell draw-afternoon carryover-cell ${carryover < 0 ? 'negative-value' : ''}`} key={`${agent.key}-carryover`}>{formatAmount(carryover)}</td>] : []),
                ...(drawGroup.key === 'evening' ? [<td className={`draw-cell draw-evening carryover-cell ${thirdCarryover < 0 ? 'negative-value' : ''}`} key={`${agent.key}-third-carryover`}>{formatAmount(thirdCarryover)}</td>] : []),
                <td className={`draw-cell draw-${drawGroup.key} net-cell ${net < 0 ? 'negative-value' : ''}`} key={`${agent.key}-${drawGroup.key}-net`}>{formatAmount(net)}</td>,
              ]
            })}
            <td className="draw-cell draw-commission"><strong>{formatAmount(agent.totalGross * 0.1)}</strong></td><td className={`draw-cell draw-net-sales ${getGroupedNet(agent, drawGroups[2]) - (agent.totalGross * 0.1) < 0 ? 'negative-value' : ''}`}><strong>{formatAmount(getGroupedNet(agent, drawGroups[2]) - (agent.totalGross * 0.1))}</strong></td><td className="draw-cell draw-overall"><strong>{formatAmount(agent.totalGross)}</strong></td><td className="draw-cell draw-overall"><strong>{formatAmount(agent.totalHits)}</strong></td><td className="draw-cell draw-overall net-cell"><strong>{formatAmount(agent.totalGross - agent.totalHits)}</strong></td>
          </tr>)}
          <tr className="total-row">
            <td><strong>Supervisor total</strong></td>
            {drawGroups.flatMap((drawGroup) => {
              const gross = group.agents.reduce((total, agent) => total + getGroupedDrawTotal(agent, drawGroup, 'gross'), 0)
              const hits = group.agents.reduce((total, agent) => total + getGroupedDrawTotal(agent, drawGroup, 'hits'), 0)
              const net = drawGroup.key === 'afternoon'
                ? getSupervisorCarryoverTotal(group) - hits
                : drawGroup.key === 'evening'
                  ? getSupervisorThirdDrawCarryover(group) - hits
                  : gross - hits
              const carryover = getSupervisorCarryoverTotal(group)
              const thirdCarryover = getSupervisorThirdDrawCarryover(group)
              return [
                <td className={`draw-cell draw-${drawGroup.key} ${gross < 0 ? 'negative-value' : ''}`} key={`total-${drawGroup.key}-gross`}><strong>{formatAmount(gross)}</strong></td>,
                <td className={`draw-cell draw-${drawGroup.key} ${hits < 0 ? 'negative-value' : ''}`} key={`total-${drawGroup.key}-hits`}><strong>{formatAmount(hits)}</strong></td>,
                ...(drawGroup.key === 'afternoon' ? [<td className={`draw-cell draw-afternoon carryover-cell ${carryover < 0 ? 'negative-value' : ''}`} key="total-carryover"><strong>{formatAmount(carryover)}</strong></td>] : []),
                ...(drawGroup.key === 'evening' ? [<td className={`draw-cell draw-evening carryover-cell ${thirdCarryover < 0 ? 'negative-value' : ''}`} key="total-third-carryover"><strong>{formatAmount(thirdCarryover)}</strong></td>] : []),
                <td className={`draw-cell draw-${drawGroup.key} net-cell ${net < 0 ? 'negative-value' : ''}`} key={`total-${drawGroup.key}-net`}><strong>{formatAmount(net)}</strong></td>,
              ]
            })}
            <td className="draw-cell draw-commission"><strong>{formatAmount(group.totalGross * 0.1)}</strong></td><td className={`draw-cell draw-net-sales ${getSupervisorThirdDrawCarryover(group) - (group.totalGross * 0.1) < 0 ? 'negative-value' : ''}`}><strong>{formatAmount(getSupervisorThirdDrawCarryover(group) - (group.totalGross * 0.1))}</strong></td><td className="draw-cell draw-overall"><strong>{formatAmount(group.totalGross)}</strong></td><td className="draw-cell draw-overall"><strong>{formatAmount(group.totalHits)}</strong></td><td className="draw-cell draw-overall net-cell"><strong>{formatAmount(group.totalGross - group.totalHits)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [supervisorRows, setSupervisorRows] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [activeView, setActiveView] = useState('overview')

  const loadReport = useCallback(async (selectedDate) => {
    setLoading(true)
    setError('')

    try {
      const headers = authorization
        ? { Authorization: `Bearer ${authorization}`, Accept: 'application/json' }
        : { Accept: 'application/json' }
      let reportRows
      if (activeView === 'reports' && drawApiUrl && drawIds.length > 0) {
        const [responses, supervisorResponse] = await Promise.all([Promise.all(drawIds.map(async (drawId) => {
          const requestUrl = new URL(drawApiUrl)
          requestUrl.searchParams.set('drawId', drawId)
          requestUrl.searchParams.set('from', selectedDate)
          requestUrl.searchParams.set('to', getNextDate(selectedDate))
          const response = await fetch(requestUrl, { headers })
          if (!response.ok) throw new Error(`Hindi ma-load ang draw ${drawId} (${response.status})`)
          return normalizeRows(await response.json())
        })), (() => {
          const requestUrl = new URL(supervisorApiUrl)
          requestUrl.searchParams.set('from', selectedDate)
          requestUrl.searchParams.set('to', getNextDate(selectedDate))
          return fetch(requestUrl, { headers })
        })().then(async (response) => {
          if (!response.ok) throw new Error(`Hindi ma-load ang supervisor names (${response.status})`)
          return normalizeRows(await response.json())
        })])
        reportRows = responses.flat()
        setSupervisorRows(supervisorResponse)
      } else {
        const sourceApiUrl = overallApiUrl || tellerApiUrl
        const requestUrl = new URL(sourceApiUrl)
        requestUrl.searchParams.set('from', selectedDate)
        requestUrl.searchParams.set('to', getNextDate(selectedDate))
        const response = await fetch(requestUrl, { headers })
        if (!response.ok) throw new Error(`Hindi ma-load ang report (${response.status})`)
        reportRows = normalizeRows(await response.json())
        setSupervisorRows([])
      }
      setRows(reportRows)
      setLastUpdated(new Date())
    } catch (requestError) {
      setError(requestError.message || 'May problema sa pagkuha ng report.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [activeView])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => loadReport(defaultFromDate), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadReport])

  const columns = getColumns(rows)
  const drawRows = rows.filter((row) => row && row.drawTime !== undefined)
  const supervisorReports = getSupervisorReports(drawRows, supervisorRows)
  const hasAgentFields = drawRows.some((row) => getFirstField(row, agentFieldNames) !== null)
  const hasSupervisorFields = drawRows.some((row) => getFirstField(row, supervisorFieldNames) !== null)
  const totalGross = drawRows.reduce((total, row) => total + (Number(row.TotalOveAllGross) || 0), 0)
  const sourceApiUrl = activeView === 'reports' ? tellerApiUrl : (overallApiUrl || tellerApiUrl)
  const endpointLabel = sourceApiUrl ? new URL(sourceApiUrl).pathname : 'API endpoint not configured'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><img className="brand-logo" src="/LB.png" alt="Lucky Betplay Corporation" /><span><strong>STL Reports</strong><small>Finance workspace</small></span></div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <button className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} type="button" onClick={() => setActiveView('overview')}><span className="nav-icon"><Icon name="overview" /></span> Overview</button>
          <button className={`nav-item ${activeView === 'reports' ? 'active' : ''}`} type="button" onClick={() => setActiveView('reports')}><span className="nav-icon"><Icon name="reports" /></span> Reports</button>
          <button className="nav-item" type="button"><span className="nav-icon"><Icon name="activity" /></span> Activity</button>
        </nav>
        <div className="sidebar-footer"><div className="status-dot" /><div><strong>System connected</strong><span>Live API source</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">ACCOUNTING / {activeView.toUpperCase()}</p><h1>{activeView === 'reports' ? 'Agent reports' : 'Overall reports'}</h1></div>
          <div className="topbar-actions"><span className="date-label">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting...'}</span><button className="refresh-button" type="button" onClick={() => loadReport(fromDate)} disabled={loading}><Icon name="refresh" size={15} /> {loading ? 'Loading' : 'Refresh'}</button><div className="avatar" aria-label="Accountant profile">AC</div></div>
        </header>

        <section className="content-area">
          <div className="welcome-row"><div><h2>Good day, Accountant</h2><p>Here is the latest consolidated view from your reporting source.</p></div><span className="live-badge"><span /> Live data</span></div>
          <form className="date-filter" onSubmit={(event) => { event.preventDefault(); loadReport(fromDate) }}>
            <div className="date-field"><label htmlFor="target-date">Target date</label><input id="target-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required /></div>
            <span className="date-helper">Showing all draws for one day</span>
            <button className="apply-button" type="submit" disabled={loading || !fromDate}>Show this day</button>
          </form>
          {activeView === 'overview' && <div className="metric-grid">
            <article className="metric-card accent-card"><span className="metric-icon"><Icon name="money" /></span><div><span className="metric-label">Total agent gross</span><strong>{loading ? '...' : formatCurrency(totalGross)}</strong></div><span className="metric-trend">All draws</span></article>
            <article className="metric-card"><span className="metric-icon soft"><Icon name="fields" /></span><div><span className="metric-label">Data fields</span><strong>{columns.length}</strong></div><span className="metric-trend neutral">Synced</span></article>
            <article className="metric-card"><span className="metric-icon soft"><Icon name="check" /></span><div><span className="metric-label">Connection</span><strong>{error ? 'Issue' : 'Healthy'}</strong></div><span className={`metric-trend ${error ? 'warning' : ''}`}>{error ? 'Check API' : 'Online'}</span></article>
          </div>}

          {activeView === 'reports' && !loading && !error && drawRows.length > 0 && <DrawGrossSummary rows={drawRows} />}

          {activeView === 'reports' && !loading && !error && <section className="report-panel gross-panel supervisor-report">
            <div className="panel-heading"><div><h2>Gross per supervisor</h2><p className="source-label">Teller performance for the selected day</p></div><span className="record-count">{supervisorReports.length} supervisors</span></div>
            {!hasAgentFields || !hasSupervisorFields ? <div className="breakdown-note">The current API response does not include {hasAgentFields ? 'supervisor' : hasSupervisorFields ? 'agent' : 'agent or supervisor'} fields, so the available gross is grouped as unspecified. The endpoint must return those fields for an attributed breakdown.</div> : null}
            {drawRows.length === 0 ? <div className="state-message">No agent report records were returned for this date.</div> : <div className="supervisor-groups">{supervisorReports.map((group) => <section className="supervisor-group" key={group.supervisor}>
              <div className="supervisor-heading"><strong>{group.supervisor}</strong><span>{group.agents.length} agents / {drawGroups.length} draw groups</span></div>
              <MatrixTable group={group} />
            </section>)}</div>}
          </section>}

          {activeView === 'overview' && <>
          {!loading && !error && drawRows.length > 0 && <section className="report-panel gross-panel">
            <div className="panel-heading"><div><h2>Agent gross per draw</h2><p className="source-label">Consolidated gross from the live report source</p></div><span className="record-count">{drawRows.length} draws</span></div>
            <div className="table-wrap"><table className="gross-table"><thead><tr><th>Draw</th><th>Agent gross</th><th>Hits</th><th>Kabig</th><th>Status</th></tr></thead><tbody>{drawRows.map((row, rowIndex) => <tr key={row.id ?? rowIndex}><td><strong>Draw {formatDrawTime(row.drawTime)}</strong></td><td className="gross-value">{formatCurrency(row.TotalOveAllGross)}</td><td>{formatCurrency(row.TotalOveAllHits)}</td><td>{formatCurrency(row.TotalOveAllKabig)}</td><td><span className="status-pill">{row.status === 2 ? 'Completed' : formatValue(row.status)}</span></td></tr>)}</tbody></table></div>
          </section>}

          <section className="report-panel">
            <div className="panel-heading"><div><h2>Report data</h2><p className="source-label">Source <code>{endpointLabel}</code></p></div><span className="record-count">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span></div>
            {loading && <div className="state-message"><span className="spinner" /> Fetching the latest report...</div>}
            {error && !loading && <div className="state-message error-state"><strong>Unable to load data</strong><span>{error}</span><button type="button" onClick={loadReport}>Try again</button></div>}
            {!loading && !error && rows.length === 0 && <div className="state-message">No report records were returned by the source API.</div>}
            {!loading && !error && rows.length > 0 && columns.length > 0 && <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={row.id ?? rowIndex}>{columns.map((column) => <td key={column}>{formatReportValue(row?.[column], column)}</td>)}</tr>)}</tbody></table></div>}
          </section>
          </>}
        </section>
      </main>
    </div>
  )
}

export default App
