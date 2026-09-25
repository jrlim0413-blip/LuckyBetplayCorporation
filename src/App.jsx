import { useCallback, useEffect, useState } from 'react'
import './App.css'

const tellerApiUrl = import.meta.env.VITE_API_URL
const drawApiUrl = import.meta.env.VITE_DRAW_API_URL
const drawIds = (import.meta.env.VITE_DRAW_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
const overallApiUrl = import.meta.env.VITE_OVERALL_API_URL
const supervisorApiUrl = import.meta.env.VITE_SUPERVISOR_API_URL
const authorization = import.meta.env.VITE_AUTHORIZATION
const configuredBranch = import.meta.env.VITE_BRANCH_NAME || 'Mandaue'

function getCurrentDate() {
  return formatDate(new Date())
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function getPreviousDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() - 1)
  return formatDate(date)
}

function getNextDate(dateValue) {
  const nextDate = new Date(`${dateValue}T00:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  return formatDate(nextDate)
}

function getYesterdayDate() {
  return getPreviousDate(getCurrentDate())
}

function formatDisplayDate(dateValue) {
  if (!dateValue) return '—'
  const today = getCurrentDate()
  const yesterday = getYesterdayDate()
  const date = new Date(`${dateValue}T00:00:00`)
  const options = { month: 'short', day: 'numeric', year: 'numeric', weekday: 'short' }
  const formatted = date.toLocaleDateString('en-US', options)

  if (dateValue === today) return `Today (${formatted})`
  if (dateValue === yesterday) return `Yesterday (${formatted})`
  return formatted
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
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function formatAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
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
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    calendar: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    history: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    alert: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    gauge: <><path d="M12 14v-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
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
  const secondDrawNet = getGroupedNet(agent, drawGroups[1])
  const thirdDrawGross = getGroupedDrawTotal(agent, drawGroups[2], 'gross')
  return Math.max(secondDrawNet, 0) + thirdDrawGross
}

function getSupervisorThirdDrawCarryover(group) {
  return group.agents.reduce((total, agent) => total + getThirdDrawCarryover(agent), 0)
}

function DrawGrossSummary({ supervisorReports }) {
  const totals = drawGroups.map((group) => {
    let gross = 0
    let hits = 0
    supervisorReports.forEach((supervisorGroup) => {
      supervisorGroup.agents.forEach((agent) => {
        gross += getGroupedDrawTotal(agent, group, 'gross')
        hits += getGroupedDrawTotal(agent, group, 'hits')
      })
    })
    return {
      ...group,
      gross,
      hits,
    }
  })

  const overallGross = totals.reduce((total, group) => total + group.gross, 0)
  const overallHits = totals.reduce((total, group) => total + group.hits, 0)
  const overallCommission = supervisorReports.reduce(
    (total, group) => total + group.agents.reduce((agentTotal, agent) => agentTotal + (agent.totalGross * 0.1), 0),
    0
  )
  const overallNetSales = overallGross - (overallHits + overallCommission)

  return (
    <section className="draw-summary" aria-label="Total gross and hits per draw summary">
      <div className="draw-summary-heading">
        <div>
          <strong>Total gross &amp; hits per draw</strong>
          <span>Consolidated from frontend supervisor rows</span>
        </div>
        <div className="draw-summary-heading-totals">
          <div className="summary-total-chip gross-chip">
            <small>Overall Gross</small>
            <strong>{formatAmount(overallGross)}</strong>
          </div>
          <div className="summary-total-chip hits-chip">
            <small>Overall Hits</small>
            <strong>{formatAmount(overallHits)}</strong>
          </div>
          <div className="summary-total-chip commission-chip">
            <small>Commission</small>
            <strong>{formatAmount(overallCommission)}</strong>
          </div>
          <div className={`summary-total-chip net-sales-chip ${overallNetSales < 0 ? 'negative-val' : ''}`}>
            <small>Net Sales</small>
            <strong>{formatAmount(overallNetSales)}</strong>
          </div>
        </div>
      </div>
      <div className="draw-summary-grid">
        {totals.map((group) => (
          <div className={`draw-summary-card draw-${group.key}`} key={group.key}>
            <div className="draw-card-header">
              <span className="draw-card-label">{group.label.toUpperCase()}</span>
              <small className="draw-card-schedule">{group.schedule}</small>
            </div>
            <div className="draw-card-values">
              <div className="draw-value-col">
                <small>Gross</small>
                <strong className="draw-gross-num">{formatAmount(group.gross)}</strong>
              </div>
              <div className="draw-value-col">
                <small>Hits</small>
                <strong className="draw-hits-num">{formatAmount(group.hits)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}



function MatrixTable({ group, showOverall = false }) {
  const supervisorPositiveThirdNetSales = group.agents.reduce((total, agent) => {
    const agentOverallCommission = agent.totalGross * 0.1
    const agentThirdNetSales = getGroupedNet(agent, drawGroups[2]) - agentOverallCommission
    return total + (agentThirdNetSales > 0 ? agentThirdNetSales : 0)
  }, 0)

  return (
    <div className="table-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th className="agent-header" rowSpan="2">Agent</th>
            {drawGroups.map((drawGroup) => <th className={`draw-group-heading draw-${drawGroup.key}`} colSpan={drawGroup.key === 'morning' ? 3 : 4} key={drawGroup.key}><span>{drawGroup.label}</span><small>{drawGroup.schedule}</small></th>)}
            <th className="draw-group-heading draw-commission" rowSpan="2"><span>Commission</span><small>10% of Gross</small></th>
            <th className="draw-group-heading draw-net-sales" rowSpan="2"><span>Net Sales</span><small>3rd Net - Commission</small></th>
            {showOverall && (
              <>
                <th className="draw-separator-col" rowSpan="2" aria-hidden="true"></th>
                <th className="draw-group-heading draw-overall" colSpan="5"><span>Overall</span><small>All draws</small></th>
              </>
            )}
          </tr>
          <tr>
            {drawGroups.flatMap((drawGroup) => [
              <th className={`draw-subheading draw-${drawGroup.key}`} key={`${drawGroup.key}-gross`}><span className="draw-header-label">Gross</span></th>,
              <th className={`draw-subheading draw-${drawGroup.key}`} key={`${drawGroup.key}-hits`}><span className="draw-header-label">Hits</span></th>,
              ...(drawGroup.key === 'afternoon' ? [<th className="draw-subheading draw-afternoon carryover-header" key="afternoon-carryover" title="1st Draw Net + 2nd Draw Gross"><small>1st Net + 2nd Gross</small></th>] : []),
              ...(drawGroup.key === 'evening' ? [<th className="draw-subheading draw-evening carryover-header" key="evening-carryover" title="2nd Draw Net + 3rd Draw Gross"><small>2nd Net + 3rd Gross</small></th>] : []),
              <th className={`draw-subheading draw-${drawGroup.key}`} key={`${drawGroup.key}-net`}><span className="draw-header-label">Net</span></th>,
            ])}
            {showOverall && (
              <>
                <th className="draw-subheading draw-overall"><span className="draw-header-label">Gross</span></th>
                <th className="draw-subheading draw-overall"><span className="draw-header-label">Hits</span></th>
                <th className="draw-subheading draw-overall"><span className="draw-header-label">Commission</span></th>
                <th className="draw-subheading draw-overall"><span className="draw-header-label">Net</span></th>
                <th className="draw-subheading draw-overall"><span className="draw-header-label">Net Sales</span></th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {group.agents.map((agent) => {
            const agentOverallNet = agent.totalGross - agent.totalHits
            const agentOverallCommission = agent.totalGross * 0.1
            const agentOverallNetSales = agentOverallNet - agentOverallCommission
            const agentThirdNetSales = getGroupedNet(agent, drawGroups[2]) - agentOverallCommission
            return (
              <tr key={`${group.supervisor}-${agent.key}`}>
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
                <td className="draw-cell draw-commission"><strong>{formatAmount(agentOverallCommission)}</strong></td>
                <td className={`draw-cell draw-net-sales ${agentThirdNetSales < 0 ? 'negative-value' : ''}`}><strong>{formatAmount(agentThirdNetSales)}</strong></td>
                {showOverall && (
                  <>
                    <td className="draw-separator-cell" aria-hidden="true" />
                    <td className="draw-cell draw-overall"><strong>{formatAmount(agent.totalGross)}</strong></td>
                    <td className="draw-cell draw-overall"><strong>{formatAmount(agent.totalHits)}</strong></td>
                    <td className="draw-cell draw-overall"><strong>{formatAmount(agentOverallCommission)}</strong></td>
                    <td className="draw-cell draw-overall net-cell"><strong>{formatAmount(agentOverallNet)}</strong></td>
                    <td className={`draw-cell draw-overall draw-overall-net-sales ${agentOverallNetSales < 0 ? 'negative-value' : ''}`}><strong>{formatAmount(agentOverallNetSales)}</strong></td>
                  </>
                )}
              </tr>
            )
          })}
          <tr className="total-row">
            <td className="agent-name-cell total-agent-cell"><strong>Supervisor total</strong></td>
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
            <td className="draw-cell draw-commission"><strong>{formatAmount(group.totalGross * 0.1)}</strong></td>
            <td className="draw-cell draw-net-sales"><strong>{formatAmount(supervisorPositiveThirdNetSales)}</strong></td>
            {showOverall && (
              <>
                <td className="draw-separator-cell" aria-hidden="true" />
                <td className="draw-cell draw-overall"><strong>{formatAmount(group.totalGross)}</strong></td>
                <td className="draw-cell draw-overall"><strong>{formatAmount(group.totalHits)}</strong></td>
                <td className="draw-cell draw-overall"><strong>{formatAmount(group.totalGross * 0.1)}</strong></td>
                <td className="draw-cell draw-overall net-cell"><strong>{formatAmount(group.totalGross - group.totalHits)}</strong></td>
                <td className={`draw-cell draw-overall draw-overall-net-sales ${(group.totalGross - group.totalHits) - (group.totalGross * 0.1) < 0 ? 'negative-value' : ''}`}><strong>{formatAmount((group.totalGross - group.totalHits) - (group.totalGross * 0.1))}</strong></td>
              </>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function getAgentOverallMetrics(agent) {
  const gross = Number(agent.totalGross) || 0
  const hits = Number(agent.totalHits) || 0
  const commission = gross * 0.1
  const net = gross - hits
  const netSales = net - commission
  return { gross, hits, commission, net, netSales }
}

function splitAgentsByRemittance(agents = []) {
  const positive = []
  const negative = []

  agents.forEach((agent) => {
    const metrics = getAgentOverallMetrics(agent)
    if (metrics.netSales >= 0) {
      positive.push({ ...agent, ...metrics })
    } else {
      negative.push({ ...agent, ...metrics })
    }
  })

  return { positive, negative }
}

function calculateMetricsTotals(list = []) {
  return list.reduce(
    (acc, item) => ({
      gross: acc.gross + item.gross,
      hits: acc.hits + item.hits,
      commission: acc.commission + item.commission,
      net: acc.net + item.net,
      netSales: acc.netSales + item.netSales,
    }),
    { gross: 0, hits: 0, commission: 0, net: 0, netSales: 0 }
  )
}

function SupervisorStatementTable({ group, selectedDate, branchName = configuredBranch, isModal = false }) {
  const { positive, negative } = splitAgentsByRemittance(group?.agents || [])
  const positiveTotals = calculateMetricsTotals(positive)
  const negativeTotals = calculateMetricsTotals(negative)
  const grandTotals = {
    gross: positiveTotals.gross + negativeTotals.gross,
    hits: positiveTotals.hits + negativeTotals.hits,
    commission: positiveTotals.commission + negativeTotals.commission,
    net: positiveTotals.net + negativeTotals.net,
    netSales: positiveTotals.netSales + negativeTotals.netSales,
  }

  return (
    <div className={`statement-sheet ${isModal ? 'statement-sheet-modal' : 'statement-sheet-inline'}`}>
      <div className="statement-header-block">
        <h3 className="statement-company-title">LUCKY BETPLAY CORPORATION</h3>
        <div className="statement-branch-tag">
          <span>BRANCH:</span> <strong>{branchName.toUpperCase()}</strong>
        </div>
        <h4 className="statement-report-title">CONDENSED SUPERVISOR AGENT REMITTANCE SUMMARY</h4>
        <p className="statement-report-subtitle">(Unaudited — Based on Consolidated Overall Draws Performance)</p>
        <div className="statement-meta-row">
          <span className="statement-meta-pill"><strong>BRANCH:</strong> {branchName}</span>
          <span className="statement-meta-divider">•</span>
          <span className="statement-meta-pill"><strong>SUPERVISOR:</strong> {group.supervisor}</span>
          <span className="statement-meta-divider">•</span>
          <span className="statement-meta-pill"><strong>DATE:</strong> {formatDisplayDate(selectedDate)}</span>
          <span className="statement-meta-divider">•</span>
          <span className="statement-meta-pill"><strong>TOTAL AGENTS:</strong> {group.agents?.length || 0}</span>
        </div>
      </div>

      <div className="statement-table-container">
        <table className="statement-balance-table">
          <thead>
            <tr className="statement-th-row">
              <th className="statement-th statement-th-agent">AGENT / TELLER</th>
              <th className="statement-th statement-th-num">GROSS</th>
              <th className="statement-th statement-th-num">HITS</th>
              <th className="statement-th statement-th-num">COMMISSION (10%)</th>
              <th className="statement-th statement-th-num">NET</th>
              <th className="statement-th statement-th-num statement-th-remit">NET SALES / REMITTANCE</th>
            </tr>
          </thead>
          <tbody>
            <tr className="statement-section-divider-row">
              <td colSpan={6} className="statement-section-heading-cell">
                <strong>POSITIVE REMITTANCES (TO COLLECT / SOLVENT AGENTS):</strong>
              </td>
            </tr>

            {positive.length === 0 ? (
              <tr className="statement-empty-state-row">
                <td colSpan={6} className="statement-empty-state-cell">
                  No positive remittance agents recorded for this period.
                </td>
              </tr>
            ) : (
              positive.map((agent, index) => (
                <tr key={`pos-${agent.key || index}`} className="statement-data-row statement-pos-row">
                  <td className="statement-td statement-agent-td">
                    <span className="statement-agent-name">{agent.teller}</span>
                  </td>
                  <td className="statement-td statement-num-td">
                    {index === 0 && <span className="accounting-currency-symbol">₱</span>}
                    {formatAmount(agent.gross)}
                  </td>
                  <td className="statement-td statement-num-td">{formatAmount(agent.hits)}</td>
                  <td className="statement-td statement-num-td">{formatAmount(agent.commission)}</td>
                  <td className="statement-td statement-num-td">{formatAmount(agent.net)}</td>
                  <td className="statement-td statement-num-td statement-remit-td">
                    {index === 0 && <span className="accounting-currency-symbol">₱</span>}
                    <strong>{formatAmount(agent.netSales)}</strong>
                  </td>
                </tr>
              ))
            )}

            <tr className="statement-subtotal-data-row statement-pos-subtotal-row">
              <td className="statement-td statement-subtotal-label-td">
                <span className="statement-subtotal-indent">Total Positive Remittances (Subtotal)</span>
              </td>
              <td className="statement-td statement-subtotal-num-td">
                <span className="accounting-currency-symbol">₱</span>
                <strong>{formatAmount(positiveTotals.gross)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td">
                <strong>{formatAmount(positiveTotals.hits)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td">
                <strong>{formatAmount(positiveTotals.commission)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td">
                <strong>{formatAmount(positiveTotals.net)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td statement-remit-td">
                <span className="accounting-currency-symbol">₱</span>
                <strong>{formatAmount(positiveTotals.netSales)}</strong>
              </td>
            </tr>

            <tr className="statement-spacer-divider-row" aria-hidden="true">
              <td colSpan={6} />
            </tr>

            <tr className="statement-section-divider-row statement-negative-header-row">
              <td colSpan={6} className="statement-section-heading-cell statement-negative-heading-cell">
                <strong>NEGATIVE DEFICITS:</strong>
              </td>
            </tr>

            {negative.length === 0 ? (
              <tr className="statement-empty-state-row">
                <td colSpan={6} className="statement-empty-state-cell statement-clean-indicator">
                  ✓ No negative deficit records — all {positive.length} agents are solvent with positive balances.
                </td>
              </tr>
            ) : (
              negative.map((agent, index) => (
                <tr key={`neg-${agent.key || index}`} className="statement-data-row statement-neg-row">
                  <td className="statement-td statement-agent-td">
                    <span className="statement-agent-name">{agent.teller}</span>
                  </td>
                  <td className="statement-td statement-num-td">
                    {index === 0 && <span className="accounting-currency-symbol">₱</span>}
                    {formatAmount(agent.gross)}
                  </td>
                  <td className="statement-td statement-num-td accounting-deficit-text">{formatAmount(agent.hits)}</td>
                  <td className="statement-td statement-num-td">{formatAmount(agent.commission)}</td>
                  <td className="statement-td statement-num-td accounting-deficit-text">{formatAmount(agent.net)}</td>
                  <td className="statement-td statement-num-td statement-remit-td accounting-deficit-text">
                    {index === 0 && <span className="accounting-currency-symbol">₱</span>}
                    <strong>({formatAmount(Math.abs(agent.netSales))})</strong>
                  </td>
                </tr>
              ))
            )}

            <tr className="statement-subtotal-data-row statement-neg-subtotal-row">
              <td className="statement-td statement-subtotal-label-td">
                <span className="statement-subtotal-indent statement-neg-label-indent">Total Deficits (Subtotal)</span>
              </td>
              <td className="statement-td statement-subtotal-num-td statement-neg-subtotal-cell">
                <span className="accounting-currency-symbol">₱</span>
                <strong>{formatAmount(negativeTotals.gross)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td statement-neg-subtotal-cell accounting-deficit-text">
                <strong>{formatAmount(negativeTotals.hits)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td statement-neg-subtotal-cell">
                <strong>{formatAmount(negativeTotals.commission)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td statement-neg-subtotal-cell accounting-deficit-text">
                <strong>{formatAmount(negativeTotals.net)}</strong>
              </td>
              <td className="statement-td statement-subtotal-num-td statement-remit-td statement-neg-subtotal-cell accounting-deficit-text">
                <span className="accounting-currency-symbol">₱</span>
                <strong>({formatAmount(Math.abs(negativeTotals.netSales))})</strong>
              </td>
            </tr>

            <tr className="statement-spacer-divider-row" aria-hidden="true">
              <td colSpan={6} />
            </tr>

            <tr className="statement-grand-total-row">
              <td className="statement-td statement-grand-label-td">
                <strong>CONSOLIDATED SUPERVISOR TOTAL (OVERALL DRAWS)</strong>
              </td>
              <td className="statement-td statement-grand-num-td">
                <span className="accounting-currency-symbol">₱</span>
                <strong>{formatAmount(grandTotals.gross)}</strong>
              </td>
              <td className="statement-td statement-grand-num-td">
                <strong>{formatAmount(grandTotals.hits)}</strong>
              </td>
              <td className="statement-td statement-grand-num-td">
                <strong>{formatAmount(grandTotals.commission)}</strong>
              </td>
              <td className="statement-td statement-grand-num-td">
                <strong>{formatAmount(grandTotals.net)}</strong>
              </td>
              <td className={`statement-td statement-grand-num-td statement-remit-td ${grandTotals.netSales < 0 ? 'accounting-deficit-text' : ''}`}>
                <span className="accounting-currency-symbol">₱</span>
                <strong>{grandTotals.netSales < 0 ? `(${formatAmount(Math.abs(grandTotals.netSales))})` : formatAmount(grandTotals.netSales)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="statement-signatures-section">
        <div className="statement-sig-column">
          <div className="statement-sig-line" />
          <span className="statement-sig-title">SUPERVISOR - {branchName ? branchName.toUpperCase() : 'MANDAUE CITY'}</span>
          <strong className="statement-sig-name">{group.supervisor}</strong>
        </div>
        <div className="statement-sig-column">
          <div className="statement-sig-line" />
          <span className="statement-sig-title">CASHIER / RECEIVER</span>
          <span className="statement-sig-name">Cashier / Receiver ({branchName})</span>
        </div>
      </div>
    </div>
  )
}

function SupervisorStatementModal({ group, selectedDate, allSupervisors = [], branchName = configuredBranch, onClose, onSelectSupervisor }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const consolidatedOption = {
    supervisor: 'ALL SUPERVISORS (CONSOLIDATED)',
    agents: allSupervisors.flatMap((s) => s.agents.map((a) => ({
      ...a,
      teller: `${a.teller} (${s.supervisor})`,
    }))),
  }

  return (
    <div className="statement-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="statement-modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="statement-modal-controls-bar no-print">
          <div className="statement-controls-left">
            <span className="statement-controls-title">Supervisor Remittance Statement</span>
            {allSupervisors.length > 1 && (
              <div className="statement-dropdown-wrap">
                <Icon name="user" size={13} />
                <select
                  value={group.supervisor}
                  onChange={(e) => {
                    if (e.target.value === 'ALL SUPERVISORS (CONSOLIDATED)') {
                      onSelectSupervisor(consolidatedOption)
                    } else {
                      const found = allSupervisors.find((g) => g.supervisor === e.target.value)
                      if (found) onSelectSupervisor(found)
                    }
                  }}
                  className="statement-supervisor-dropdown"
                >
                  <option value="ALL SUPERVISORS (CONSOLIDATED)">ALL SUPERVISORS (CONSOLIDATED)</option>
                  <optgroup label="Individual Supervisors">
                    {allSupervisors.map((s) => (
                      <option key={s.supervisor} value={s.supervisor}>
                        {s.supervisor} ({s.agents.length} agents)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
          </div>
          <div className="statement-controls-right">
            <button
              type="button"
              className="statement-action-btn statement-print-trigger-btn"
              onClick={() => window.print()}
              title="Print official document (A4 / Letter)"
            >
              <Icon name="print" size={14} />
              <span>Print Statement</span>
            </button>
            <button
              type="button"
              className="statement-action-btn statement-close-trigger-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        <div className="statement-modal-content-area">
          <SupervisorStatementTable group={group} selectedDate={selectedDate} branchName={branchName} isModal={true} />
        </div>
      </div>
    </div>
  )
}

function App() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [supervisorRows, setSupervisorRows] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [selectedDate, setSelectedDate] = useState(defaultFromDate)
  const [activeView, setActiveView] = useState('overview')
  const [selectedSupervisor, setSelectedSupervisor] = useState('all')
  const [showOverall, setShowOverall] = useState(false)
  const [reportViewMode, setReportViewMode] = useState('matrix')
  const [statementModalGroup, setStatementModalGroup] = useState(null)

  const isToday = selectedDate === getCurrentDate()
  const isYesterday = selectedDate === getYesterdayDate()

  const loadReport = useCallback(async (targetDate = selectedDate) => {
    const queryDate = targetDate || selectedDate || getCurrentDate()
    setLoading(true)
    setError('')

    try {
      const headers = authorization
        ? { Authorization: `Bearer ${authorization}`, Accept: 'application/json' }
        : { Accept: 'application/json' }
      let reportRows
      if (activeView === 'reports') {
        let targetDrawIds = []
        if (overallApiUrl) {
          try {
            const overallUrl = new URL(overallApiUrl)
            overallUrl.searchParams.set('from', queryDate)
            overallUrl.searchParams.set('to', getNextDate(queryDate))
            const overallRes = await fetch(overallUrl, { headers })
            if (overallRes.ok) {
              const overallData = normalizeRows(await overallRes.json())
              const dynamicDrawIds = overallData.map((d) => d?.id).filter(Boolean)
              if (dynamicDrawIds.length > 0) {
                targetDrawIds = dynamicDrawIds
              }
            }
          } catch (fetchDrawsError) {
            console.warn('Hindi makuha ang dynamic draw IDs mula sa overallApiUrl:', fetchDrawsError)
          }
        }

        if (targetDrawIds.length === 0 && queryDate === getCurrentDate() && drawIds.length > 0) {
          targetDrawIds = drawIds
        }

        if (drawApiUrl && targetDrawIds.length > 0) {
          const [responses, supervisorResponse] = await Promise.all([
            Promise.all(targetDrawIds.map(async (drawId) => {
              const requestUrl = new URL(drawApiUrl)
              requestUrl.searchParams.set('drawId', drawId)
              requestUrl.searchParams.set('from', queryDate)
              requestUrl.searchParams.set('to', getNextDate(queryDate))
              const response = await fetch(requestUrl, { headers })
              if (!response.ok) throw new Error(`Hindi ma-load ang draw ${drawId} (${response.status})`)
              return normalizeRows(await response.json())
            })),
            supervisorApiUrl
              ? (async () => {
                  const requestUrl = new URL(supervisorApiUrl)
                  requestUrl.searchParams.set('from', queryDate)
                  requestUrl.searchParams.set('to', getNextDate(queryDate))
                  const response = await fetch(requestUrl, { headers })
                  if (!response.ok) throw new Error(`Hindi ma-load ang supervisor names (${response.status})`)
                  return normalizeRows(await response.json())
                })()
              : Promise.resolve([])
          ])

          reportRows = responses.flat()
          setSupervisorRows(supervisorResponse)
        } else {
          reportRows = []
          setSupervisorRows([])
        }
      } else {
        const sourceApiUrl = overallApiUrl || tellerApiUrl
        const requestUrl = new URL(sourceApiUrl)
        requestUrl.searchParams.set('from', queryDate)
        requestUrl.searchParams.set('to', getNextDate(queryDate))
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
  }, [activeView, selectedDate])

  const handleDateChange = (newDate) => {
    if (!newDate) return
    setSelectedDate(newDate)
    loadReport(newDate)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadReport(selectedDate)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [activeView, loadReport, selectedDate])

  const branchName = (!import.meta.env.VITE_BRANCH_NAME && rows.find((r) => r?.location || r?.branch || r?.branchName)?.location) || configuredBranch

  const columns = getColumns(rows)
  const drawRows = rows.filter((row) => row && row.drawTime !== undefined)
  const supervisorReports = getSupervisorReports(drawRows, supervisorRows)

  const activeSupervisor = (selectedSupervisor !== 'all' && supervisorReports.some((group) => group.supervisor === selectedSupervisor))
    ? selectedSupervisor
    : 'all'

  const displayedSupervisors = activeSupervisor === 'all'
    ? supervisorReports
    : supervisorReports.filter((group) => group.supervisor === activeSupervisor)

  const hasAgentFields = drawRows.some((row) => getFirstField(row, agentFieldNames) !== null)
  const hasSupervisorFields = drawRows.some((row) => getFirstField(row, supervisorFieldNames) !== null)
  const totalGross = drawRows.reduce((total, row) => total + (Number(row.TotalOveAllGross ?? row.TotalOverAllGross) || 0), 0)
  const sourceApiUrl = activeView === 'reports' ? tellerApiUrl : (overallApiUrl || tellerApiUrl)
  const endpointLabel = sourceApiUrl ? new URL(sourceApiUrl).pathname : 'API endpoint not configured'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/LB.png" alt="Lucky Betplay Corporation" />
          <span>
            <strong>STL Reports</strong>
            <small className="brand-branch-badge">{branchName} Branch</small>
          </span>
        </div>
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
          <div>
            <p className="eyebrow">
              ACCOUNTING / {activeView.toUpperCase()} • <span className="topbar-branch-chip">{branchName} Branch</span>
            </p>
            <h1>{activeView === 'reports' ? 'Agent reports' : 'Overall reports'}</h1>
          </div>
          <div className="topbar-actions"><span className="date-label">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting...'}</span><button className="refresh-button" type="button" onClick={() => loadReport(selectedDate)} disabled={loading}><Icon name="refresh" size={15} /> {loading ? 'Loading' : 'Refresh'}</button><div className="avatar" aria-label="Accountant profile">AC</div></div>
        </header>

        <section className="content-area">
          <div className="welcome-row">
            <div>
              <h2>Good day, Accountant</h2>
              <p>
                {isToday
                  ? 'Here is the latest live consolidated view for today.'
                  : `Viewing previous report for ${formatDisplayDate(selectedDate)}.`}
              </p>
            </div>
            {isToday ? (
              <span className="live-badge"><span /> Live data (Today)</span>
            ) : (
              <div className="history-badge-wrap">
                <span className="history-badge"><Icon name="history" size={14} /> Previous Report</span>
                <button type="button" className="jump-today-btn" onClick={() => handleDateChange(getCurrentDate())}>Jump to Today</button>
              </div>
            )}
          </div>

          <div className="report-date-bar">
            <div className="date-bar-left">
              <div className="date-presets">
                <button
                  type="button"
                  className={`preset-btn ${isToday ? 'active' : ''}`}
                  onClick={() => handleDateChange(getCurrentDate())}
                  disabled={loading}
                >
                  <span className="preset-dot" /> Today
                </button>
                <button
                  type="button"
                  className={`preset-btn ${isYesterday ? 'active' : ''}`}
                  onClick={() => handleDateChange(getYesterdayDate())}
                  disabled={loading}
                >
                  Yesterday
                </button>
              </div>

              <div className="date-stepper-wrap">
                <button
                  type="button"
                  className="stepper-btn"
                  title="Previous day"
                  onClick={() => handleDateChange(getPreviousDate(selectedDate))}
                  disabled={loading}
                >
                  <Icon name="chevronLeft" size={15} />
                </button>

                <div className="date-input-group">
                  <Icon name="calendar" size={14} />
                  <input
                    id="report-target-date"
                    type="date"
                    value={selectedDate}
                    max={getCurrentDate()}
                    onChange={(event) => handleDateChange(event.target.value)}
                    disabled={loading}
                  />
                </div>

                <button
                  type="button"
                  className="stepper-btn"
                  title="Next day"
                  onClick={() => handleDateChange(getNextDate(selectedDate))}
                  disabled={loading || isToday}
                >
                  <Icon name="chevronRight" size={15} />
                </button>
              </div>
            </div>

            <div className="date-bar-right">
              <div className="date-info-wrap">
                <span className="date-display-label">{formatDisplayDate(selectedDate)}</span>
                {isToday ? (
                  <span className="date-tag live-tag">Current date</span>
                ) : (
                  <span className="date-tag past-tag">Previous report</span>
                )}
              </div>
              <button
                type="button"
                className="refresh-btn-bar"
                onClick={() => loadReport(selectedDate)}
                disabled={loading}
              >
                <Icon name="refresh" size={13} /> {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {activeView === 'overview' && <div className="metric-grid">
            <article className="metric-card accent-card"><span className="metric-icon"><Icon name="money" /></span><div><span className="metric-label">Total agent gross</span><strong>{loading ? '...' : formatCurrency(totalGross)}</strong></div><span className="metric-trend">All draws</span></article>
            <article className="metric-card"><span className="metric-icon soft"><Icon name="fields" /></span><div><span className="metric-label">Data fields</span><strong>{columns.length}</strong></div><span className="metric-trend neutral">Synced</span></article>
            <article className="metric-card"><span className="metric-icon soft"><Icon name="check" /></span><div><span className="metric-label">Connection</span><strong>{error ? 'Issue' : 'Healthy'}</strong></div><span className={`metric-trend ${error ? 'warning' : ''}`}>{error ? 'Check API' : 'Online'}</span></article>
          </div>}

          {activeView === 'reports' && !loading && !error && supervisorReports.length > 0 && <DrawGrossSummary supervisorReports={supervisorReports} />}

          {activeView === 'reports' && !loading && !error && <section className="report-panel gross-panel supervisor-report">
            <div className="panel-heading supervisor-panel-heading">
              <div className="panel-heading-title">
                <h2>Gross per supervisor</h2>
                <p className="source-label">Teller performance for {formatDisplayDate(selectedDate)}</p>
              </div>
              <div className="supervisor-filter-bar">
                <div className="supervisor-filter-pills">
                  <button
                    type="button"
                    className={`filter-pill-btn ${activeSupervisor === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedSupervisor('all')}
                    title="Show all supervisors"
                  >
                    <Icon name="users" size={13} />
                    <span>All Supervisors</span>
                    <span className="filter-count-badge">{supervisorReports.length}</span>
                  </button>
                </div>

                <div className="supervisor-select-group">
                  <Icon name="user" size={14} />
                  <select
                    id="supervisor-filter-dropdown"
                    className="supervisor-filter-select"
                    value={activeSupervisor}
                    onChange={(event) => setSelectedSupervisor(event.target.value)}
                    aria-label="Filter supervisor"
                  >
                    <option value="all">All Supervisors ({supervisorReports.length})</option>
                    <optgroup label="Select Specific Supervisor">
                      {supervisorReports.map((group) => (
                        <option key={group.supervisor} value={group.supervisor}>
                          {group.supervisor} ({group.agents.length} {group.agents.length === 1 ? 'agent' : 'agents'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {activeSupervisor !== 'all' && (
                  <button
                    type="button"
                    className="reset-supervisor-filter-btn"
                    onClick={() => setSelectedSupervisor('all')}
                    title="Reset to all supervisors"
                  >
                    Show All
                  </button>
                )}

                <div className="overall-toggle-container">
                  <span className="overall-toggle-divider" />
                  <label className="overall-toggle-label" htmlFor="toggle-overall-columns" title="Toggle Overall group visibility">
                    <span className="overall-toggle-text">Show Overall</span>
                    <span className="toggle-switch-ui">
                      <input
                        type="checkbox"
                        id="toggle-overall-columns"
                        className="toggle-checkbox"
                        checked={showOverall}
                        onChange={(e) => setShowOverall(e.target.checked)}
                      />
                      <span className="toggle-track-slider" />
                    </span>
                  </label>
                </div>

                <div className="view-mode-toggle-wrap">
                  <span className="overall-toggle-divider" />
                  <div className="view-mode-tabs" role="group" aria-label="Table format">
                    <button
                      type="button"
                      className={`view-mode-tab-btn ${reportViewMode === 'matrix' ? 'active' : ''}`}
                      onClick={() => setReportViewMode('matrix')}
                      title="Show Draw Matrix (10:30 AM, 2:00 PM, 3:00 PM, 5:00 PM, 7:00 PM, 9:00 PM)"
                    >
                      <Icon name="fields" size={12} />
                      <span>Draw Matrix</span>
                    </button>
                    <button
                      type="button"
                      className={`view-mode-tab-btn ${reportViewMode === 'statement' ? 'active' : ''}`}
                      onClick={() => setReportViewMode('statement')}
                      title="Show Balance Sheet Remittance Statement (Positive on top, Negative on bottom)"
                    >
                      <Icon name="fileText" size={12} />
                      <span>Remittance Statement</span>
                    </button>
                  </div>
                </div>

                {supervisorReports.length > 0 && (
                  <button
                    type="button"
                    className="supervisor-statement-top-btn"
                    onClick={() => {
                      const target = activeSupervisor !== 'all'
                        ? (displayedSupervisors[0] ?? supervisorReports[0])
                        : (displayedSupervisors[0] ?? supervisorReports[0])
                      if (target) setStatementModalGroup(target)
                    }}
                    title="View and print official balance sheet remittance statement"
                  >
                    <Icon name="print" size={13} />
                    <span>Print Statement</span>
                  </button>
                )}
              </div>
            </div>
            {!hasAgentFields || !hasSupervisorFields ? <div className="breakdown-note">The current API response does not include {hasAgentFields ? 'supervisor' : hasSupervisorFields ? 'agent' : 'agent or supervisor'} fields, so the available gross is grouped as unspecified. The endpoint must return those fields for an attributed breakdown.</div> : null}
            {drawRows.length === 0 ? <div className="state-message">No agent report records were returned for {formatDisplayDate(selectedDate)}.</div> : <div className="supervisor-groups">{displayedSupervisors.map((group) => <section className="supervisor-group" key={group.supervisor}>
              <div className="supervisor-heading">
                <div className="supervisor-heading-info">
                  <strong>{group.supervisor}</strong>
                  <span>{group.agents.length} agents / {drawGroups.length} draw groups</span>
                </div>
                <button
                  type="button"
                  className="supervisor-heading-statement-btn"
                  onClick={() => setStatementModalGroup(group)}
                  title={`Open official financial statement for ${group.supervisor}`}
                >
                  <Icon name="fileText" size={13} />
                  <span>{reportViewMode === 'statement' ? 'Print Statement' : 'Statement View'}</span>
                </button>
              </div>
              {reportViewMode === 'statement' ? (
                <SupervisorStatementTable group={group} selectedDate={selectedDate} branchName={branchName} />
              ) : (
                <MatrixTable group={group} showOverall={showOverall} />
              )}
            </section>)}</div>}
          </section>}

          {activeView === 'overview' && <>
          {!loading && !error && drawRows.length > 0 && <section className="report-panel gross-panel">
            <div className="panel-heading"><div><h2>Agent gross per draw</h2><p className="source-label">Consolidated gross for {formatDisplayDate(selectedDate)}</p></div><span className="record-count">{drawRows.length} draws</span></div>
            <div className="table-wrap"><table className="gross-table"><thead><tr><th>Draw</th><th>Agent gross</th><th>Hits</th><th>Kabig</th><th>Status</th></tr></thead><tbody>{drawRows.map((row, rowIndex) => <tr key={row.id ?? rowIndex}><td><strong>Draw {formatDrawTime(row.drawTime)}</strong></td><td className="gross-value">{formatCurrency(row.TotalOveAllGross)}</td><td>{formatCurrency(row.TotalOveAllHits)}</td><td>{formatCurrency(row.TotalOveAllKabig)}</td><td><span className="status-pill">{row.status === 2 ? 'Completed' : formatValue(row.status)}</span></td></tr>)}</tbody></table></div>
          </section>}

          <section className="report-panel">
            <div className="panel-heading"><div><h2>Report data</h2><p className="source-label">Source <code>{endpointLabel}</code></p></div><span className="record-count">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span></div>
            {loading && <div className="state-message"><span className="spinner" /> Fetching report for {formatDisplayDate(selectedDate)}...</div>}
            {error && !loading && <div className="state-message error-state"><strong>Unable to load data</strong><span>{error}</span><button type="button" onClick={() => loadReport(selectedDate)}>Try again</button></div>}
            {!loading && !error && rows.length === 0 && <div className="state-message">No report records were returned for {formatDisplayDate(selectedDate)}.</div>}
            {!loading && !error && rows.length > 0 && columns.length > 0 && <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={row.id ?? rowIndex}>{columns.map((column) => <td key={column}>{formatReportValue(row?.[column], column)}</td>)}</tr>)}</tbody></table></div>}
          </section>
          </>}
        </section>
      </main>

      {statementModalGroup && (
        <SupervisorStatementModal
          group={statementModalGroup}
          selectedDate={selectedDate}
          allSupervisors={supervisorReports}
          branchName={branchName}
          onClose={() => setStatementModalGroup(null)}
          onSelectSupervisor={(newGroup) => setStatementModalGroup(newGroup)}
        />
      )}
    </div>
  )
}

export default App
