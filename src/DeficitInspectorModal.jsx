import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './DeficitInspectorModal.css'

function formatAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0.00'
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '₱0.00'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function getGroupedDrawTotal(agent, group, field) {
  if (!agent?.draws || !group?.times) return 0
  return group.times.reduce((total, time) => {
    const d = agent.draws instanceof Map ? agent.draws.get(time) : agent.draws?.[time]
    return total + (Number(d?.[field]) || 0)
  }, 0)
}

function getCarryoverTotal(agent, drawGroups) {
  const firstDrawGross = getGroupedDrawTotal(agent, drawGroups[0], 'gross')
  const firstDrawHits = getGroupedDrawTotal(agent, drawGroups[0], 'hits')
  const firstDrawNet = firstDrawGross - firstDrawHits
  const secondDrawGross = getGroupedDrawTotal(agent, drawGroups[1], 'gross')
  return Math.max(firstDrawNet, 0) + secondDrawGross
}

function getThirdDrawCarryover(agent, drawGroups) {
  const secondDrawHits = getGroupedDrawTotal(agent, drawGroups[1], 'hits')
  const secondDrawNet = getCarryoverTotal(agent, drawGroups) - secondDrawHits
  const thirdDrawGross = getGroupedDrawTotal(agent, drawGroups[2], 'gross')
  return Math.max(secondDrawNet, 0) + thirdDrawGross
}

function getRotationNet(agent, drawGroup, drawGroups) {
  const gross = getGroupedDrawTotal(agent, drawGroup, 'gross')
  const hits = getGroupedDrawTotal(agent, drawGroup, 'hits')
  if (drawGroup.key === 'morning') {
    return gross - hits
  }
  if (drawGroup.key === 'afternoon') {
    return getCarryoverTotal(agent, drawGroups) - hits
  }
  if (drawGroup.key === 'evening') {
    return getThirdDrawCarryover(agent, drawGroups) - hits
  }
  return gross - hits
}

export default function DeficitInspectorModal({
  isOpen,
  onClose,
  supervisorReports = [],
  drawGroups = [
    { key: 'morning', label: '1st Draw', schedule: '10:30 AM + 2:00 PM', times: ['10:30 AM', '2:00 PM'] },
    { key: 'afternoon', label: '2nd Draw', schedule: '3:00 PM + 5:00 PM', times: ['3:00 PM', '5:00 PM'] },
    { key: 'evening', label: '3rd Draw', schedule: '7:00 PM + 9:00 PM', times: ['7:00 PM', '9:00 PM'] },
  ],
  selectedDate,
  branchName = 'Mandaue',
  canPrint = true,
}) {
  const [selectedDrawFilter, setSelectedDrawFilter] = useState('all') // 'all', 'morning', 'afternoon', 'evening', 'remittance', or specific time '10:30 AM', etc.
  const [selectedSupervisor, setSelectedSupervisor] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grouped') // 'grouped' | 'flat'
  const [sortBy, setSortBy] = useState('deficit-desc') // 'deficit-desc', 'deficit-asc', 'name-asc', 'spvr-asc'
  const [copiedNotice, setCopiedNotice] = useState(false)

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Extract all individual draw times
  const allDrawTimes = useMemo(() => {
    const times = []
    drawGroups.forEach((g) => {
      g.times.forEach((t) => {
        if (!times.includes(t)) times.push(t)
      })
    })
    return times
  }, [drawGroups])

  // Build the complete list of negative balance entries
  const allDeficitRecords = useMemo(() => {
    const records = []

    supervisorReports.forEach((spvrGroup) => {
      const supervisor = spvrGroup.supervisor || 'UNASSIGNED'
      const agents = spvrGroup.agents || []

      agents.forEach((agent) => {
        const agentName = agent.teller || agent.key || 'Unknown Agent'
        const agentKey = agent.key || agentName
        const commissionRate = agent.commissionRate || 10
        const totalSalary = agent.totalSalary !== undefined ? agent.totalSalary : (agent.totalGross * (commissionRate / 100))

        // 1. Morning Rotation (1st Draw)
        const morningGross = getGroupedDrawTotal(agent, drawGroups[0], 'gross')
        const morningHits = getGroupedDrawTotal(agent, drawGroups[0], 'hits')
        const morningNet = morningGross - morningHits
        if (morningNet < 0) {
          records.push({
            id: `${supervisor}-${agentKey}-morning`,
            agentName,
            agentKey,
            supervisor,
            drawCategory: 'rotation',
            drawKey: 'morning',
            drawTitle: '1st Draw (Morning)',
            drawSchedule: '10:30 AM + 2:00 PM',
            gross: morningGross,
            hits: morningHits,
            commission: 0,
            net: morningNet,
            deficit: Math.abs(morningNet),
            type: 'rotation',
          })
        }

        // 2. Afternoon Rotation (2nd Draw with carryover)
        const afternoonGross = getGroupedDrawTotal(agent, drawGroups[1], 'gross')
        const afternoonHits = getGroupedDrawTotal(agent, drawGroups[1], 'hits')
        const afternoonNet = getRotationNet(agent, drawGroups[1], drawGroups)
        if (afternoonNet < 0) {
          records.push({
            id: `${supervisor}-${agentKey}-afternoon`,
            agentName,
            agentKey,
            supervisor,
            drawCategory: 'rotation',
            drawKey: 'afternoon',
            drawTitle: '2nd Draw (Afternoon)',
            drawSchedule: '3:00 PM + 5:00 PM',
            gross: afternoonGross,
            hits: afternoonHits,
            commission: 0,
            net: afternoonNet,
            deficit: Math.abs(afternoonNet),
            type: 'rotation',
          })
        }

        // 3. Evening Rotation (3rd Draw with carryover)
        const eveningGross = getGroupedDrawTotal(agent, drawGroups[2], 'gross')
        const eveningHits = getGroupedDrawTotal(agent, drawGroups[2], 'hits')
        const eveningNet = getRotationNet(agent, drawGroups[2], drawGroups)
        if (eveningNet < 0) {
          records.push({
            id: `${supervisor}-${agentKey}-evening`,
            agentName,
            agentKey,
            supervisor,
            drawCategory: 'rotation',
            drawKey: 'evening',
            drawTitle: '3rd Draw (Evening)',
            drawSchedule: '7:00 PM + 9:00 PM',
            gross: eveningGross,
            hits: eveningHits,
            commission: 0,
            net: eveningNet,
            deficit: Math.abs(eveningNet),
            type: 'rotation',
          })
        }

        // 4. End-of-Day Remittance (3rd Net minus Commission)
        const eveningGroupNet = getRotationNet(agent, drawGroups[2], drawGroups)
        const remittanceNetSales = eveningGroupNet - totalSalary
        if (remittanceNetSales < 0) {
          records.push({
            id: `${supervisor}-${agentKey}-remittance`,
            agentName,
            agentKey,
            supervisor,
            drawCategory: 'remittance',
            drawKey: 'remittance',
            drawTitle: 'End-of-Day Remittance',
            drawSchedule: 'Final Remittance Balance',
            gross: agent.totalGross || 0,
            hits: agent.totalHits || 0,
            commission: totalSalary,
            commissionRate,
            net: remittanceNetSales,
            deficit: Math.abs(remittanceNetSales),
            type: 'remittance',
          })
        }

        // 5. Individual Draw Times (10:30 AM, 2:00 PM, 3:00 PM, 5:00 PM, 7:00 PM, 9:00 PM)
        allDrawTimes.forEach((time) => {
          const drawMap = agent.draws
          const drawData = drawMap instanceof Map ? drawMap.get(time) : drawMap?.[time]
          const drawGross = Number(drawData?.gross) || 0
          const drawHits = Number(drawData?.hits) || 0
          const drawNet = drawGross - drawHits
          if (drawNet < 0) {
            records.push({
              id: `${supervisor}-${agentKey}-time-${time}`,
              agentName,
              agentKey,
              supervisor,
              drawCategory: 'individual_time',
              drawKey: time,
              drawTitle: `Draw ${time}`,
              drawSchedule: `Specific Draw ${time}`,
              gross: drawGross,
              hits: drawHits,
              commission: 0,
              net: drawNet,
              deficit: Math.abs(drawNet),
              type: 'time',
            })
          }
        })
      })
    })

    return records
  }, [supervisorReports, drawGroups, allDrawTimes])

  // Supervisors with deficit counts
  const supervisorList = useMemo(() => {
    const map = new Map()
    supervisorReports.forEach((s) => {
      map.set(s.supervisor, 0)
    })
    allDeficitRecords.forEach((r) => {
      // count unique agents or records
      map.set(r.supervisor, (map.get(r.supervisor) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
    }))
  }, [supervisorReports, allDeficitRecords])

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    let result = allDeficitRecords

    // Draw filter
    if (selectedDrawFilter === 'all') {
      // In "all", show the primary rotations and remittance records (skip raw individual times to prevent double-counting unless selected)
      result = result.filter((r) => r.drawCategory === 'rotation' || r.drawCategory === 'remittance')
    } else if (selectedDrawFilter === 'all_including_times') {
      result = result
    } else if (['morning', 'afternoon', 'evening', 'remittance'].includes(selectedDrawFilter)) {
      result = result.filter((r) => r.drawKey === selectedDrawFilter)
    } else {
      // Specific individual draw time like '10:30 AM'
      result = result.filter((r) => r.drawKey === selectedDrawFilter)
    }

    // Supervisor filter
    if (selectedSupervisor !== 'all') {
      result = result.filter((r) => r.supervisor === selectedSupervisor)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (r) =>
          r.agentName.toLowerCase().includes(q) ||
          r.supervisor.toLowerCase().includes(q) ||
          r.drawTitle.toLowerCase().includes(q)
      )
    }

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'deficit-desc') return b.deficit - a.deficit
      if (sortBy === 'deficit-asc') return a.deficit - b.deficit
      if (sortBy === 'name-asc') return a.agentName.localeCompare(b.agentName)
      if (sortBy === 'spvr-asc') return a.supervisor.localeCompare(b.supervisor)
      return 0
    })
  }, [allDeficitRecords, selectedDrawFilter, selectedSupervisor, searchQuery, sortBy])

  // Grouped by Supervisor
  const groupedBySupervisor = useMemo(() => {
    const groups = new Map()
    filteredRecords.forEach((rec) => {
      if (!groups.has(rec.supervisor)) {
        groups.set(rec.supervisor, {
          supervisor: rec.supervisor,
          records: [],
          totalDeficit: 0,
          uniqueAgents: new Set(),
        })
      }
      const g = groups.get(rec.supervisor)
      g.records.push(rec)
      g.totalDeficit += rec.deficit
      g.uniqueAgents.add(rec.agentKey)
    })

    return Array.from(groups.values()).sort((a, b) => b.totalDeficit - a.totalDeficit)
  }, [filteredRecords])

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalDeficit = filteredRecords.reduce((sum, r) => sum + r.deficit, 0)
    const uniqueAgentKeys = new Set(filteredRecords.map((r) => `${r.supervisor}-${r.agentKey}`))
    const uniqueCount = uniqueAgentKeys.size
    const highestRecord = filteredRecords.length > 0 ? filteredRecords[0] : null
    const avgDeficit = uniqueCount > 0 ? totalDeficit / uniqueCount : 0

    return {
      totalDeficit,
      uniqueCount,
      recordCount: filteredRecords.length,
      highestRecord,
      avgDeficit,
    }
  }, [filteredRecords])

  // Copy Deficits for Viber / Messenger
  const handleCopySummary = () => {
    if (filteredRecords.length === 0) return

    let text = `🔴 LUCKY BETPLAY - DEFICIT & NEGATIVE REPORT\n`
    text += `🏢 Branch: ${branchName} | 📅 Date: ${selectedDate}\n`
    text += `🎯 Filter: ${selectedDrawFilter.toUpperCase()} | Supervisor: ${selectedSupervisor}\n`
    text += `💰 TOTAL DEFICIT: ₱ ${formatAmount(summaryMetrics.totalDeficit)} (${summaryMetrics.uniqueCount} Agents)\n`
    text += `-------------------------------------------\n`

    if (viewMode === 'grouped') {
      groupedBySupervisor.forEach((group) => {
        text += `\n👤 SUPERVISOR: ${group.supervisor} (Subtotal: ₱ ${formatAmount(group.totalDeficit)})\n`
        group.records.forEach((r) => {
          text += `  • ${r.agentName}: -₱ ${formatAmount(r.deficit)} [${r.drawTitle} | Gross: ₱${formatAmount(r.gross)} | Hits: ₱${formatAmount(r.hits)}]\n`
        })
      })
    } else {
      filteredRecords.forEach((r, idx) => {
        text += `${idx + 1}. ${r.agentName} (${r.supervisor}): -₱ ${formatAmount(r.deficit)} [${r.drawTitle}]\n`
      })
    }

    text += `\n-------------------------------------------\n`
    text += `Generated via Lucky Betplay Management Portal`

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotice(true)
      setTimeout(() => setCopiedNotice(false), 2500)
    })
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return

    const headers = ['Supervisor', 'Agent Name', 'Draw / Category', 'Schedule', 'Gross Sales', 'Hits', 'Commission', 'Net Amount', 'Deficit Amount']
    const rows = filteredRecords.map((r) => [
      `"${r.supervisor}"`,
      `"${r.agentName}"`,
      `"${r.drawTitle}"`,
      `"${r.drawSchedule}"`,
      r.gross.toFixed(2),
      r.hits.toFixed(2),
      r.commission.toFixed(2),
      r.net.toFixed(2),
      r.deficit.toFixed(2),
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `LuckyBet_Deficits_${branchName}_${selectedDate}_${selectedDrawFilter}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen) return null

  const modalNode = (
    <div className="deficit-modal-backdrop" onClick={onClose}>
      <div className="deficit-modal-shell" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Top Header */}
        <div className="deficit-modal-header">
          <div className="deficit-header-title-wrap">
            <div className="deficit-icon-pill">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <div className="deficit-title-row">
                <h2>Deficit &amp; Negative Balance Inspector</h2>
                <span className="deficit-branch-badge">{branchName} Branch</span>
                <span className="deficit-date-badge">{selectedDate}</span>
              </div>
              <p className="deficit-subtitle">
                Official draw-by-draw teller deficits per supervisor and agent.
              </p>
            </div>
          </div>

          <div className="deficit-header-actions">
            <button
              type="button"
              className={`deficit-action-btn ${copiedNotice ? 'copied-active' : ''}`}
              onClick={handleCopySummary}
              title="Copy formatted negative summary for Viber / Messenger"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copiedNotice ? 'Copied to Clipboard!' : 'Copy for Viber/Messenger'}</span>
            </button>

            <button
              type="button"
              className="deficit-action-btn"
              onClick={handleExportCSV}
              title="Export all filtered negative records to CSV"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="deficit-close-btn"
              onClick={onClose}
              title="Close modal (Esc)"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="deficit-kpi-grid">
          <div className="deficit-kpi-card total-deficit-card">
            <span className="deficit-kpi-label">TOTAL NEGATIVE EXPOSURE</span>
            <div className="deficit-kpi-value-row">
              <span className="deficit-kpi-amount">{formatCurrency(summaryMetrics.totalDeficit)}</span>
            </div>
            <span className="deficit-kpi-hint">
              Across {summaryMetrics.recordCount} negative draw records ({summaryMetrics.uniqueCount} agents)
            </span>
          </div>

          <div className="deficit-kpi-card">
            <span className="deficit-kpi-label">NEGATIVE AGENTS</span>
            <div className="deficit-kpi-value-row">
              <span className="deficit-kpi-num">{summaryMetrics.uniqueCount}</span>
              <span className="deficit-kpi-tag warning-tag">In Deficit</span>
            </div>
            <span className="deficit-kpi-hint">
              Total unique tellers with deficit balance
            </span>
          </div>

          <div className="deficit-kpi-card">
            <span className="deficit-kpi-label">AVERAGE DEFICIT / AGENT</span>
            <div className="deficit-kpi-value-row">
              <span className="deficit-kpi-num">{formatCurrency(summaryMetrics.avgDeficit)}</span>
            </div>
            <span className="deficit-kpi-hint">
              Mean negative balance per affected teller
            </span>
          </div>

          <div className="deficit-kpi-card">
            <span className="deficit-kpi-label">HIGHEST SINGLE DEFICIT</span>
            <div className="deficit-kpi-value-row">
              {summaryMetrics.highestRecord ? (
                <div>
                  <span className="deficit-kpi-agent-name">{summaryMetrics.highestRecord.agentName}</span>
                  <span className="deficit-kpi-high-val">({formatCurrency(summaryMetrics.highestRecord.deficit)})</span>
                </div>
              ) : (
                <span className="deficit-kpi-agent-name">None (₱0.00)</span>
              )}
            </div>
            <span className="deficit-kpi-hint">
              {summaryMetrics.highestRecord ? `Supervisor: ${summaryMetrics.highestRecord.supervisor}` : 'Clean balance sheet'}
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="deficit-controls-bar">
          <div className="deficit-draw-tabs-row">
            <span className="deficit-filter-caption">DRAW ROTATION:</span>
            <div className="deficit-tabs-group" role="tablist">
              <button
                type="button"
                className={`deficit-tab-btn ${selectedDrawFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDrawFilter('all')}
              >
                All Draws &amp; Remittance
              </button>
              <button
                type="button"
                className={`deficit-tab-btn tab-morning ${selectedDrawFilter === 'morning' ? 'active' : ''}`}
                onClick={() => setSelectedDrawFilter('morning')}
              >
                1st Draw (Morning)
              </button>
              <button
                type="button"
                className={`deficit-tab-btn tab-afternoon ${selectedDrawFilter === 'afternoon' ? 'active' : ''}`}
                onClick={() => setSelectedDrawFilter('afternoon')}
              >
                2nd Draw (Afternoon)
              </button>
              <button
                type="button"
                className={`deficit-tab-btn tab-evening ${selectedDrawFilter === 'evening' ? 'active' : ''}`}
                onClick={() => setSelectedDrawFilter('evening')}
              >
                3rd Draw (Evening)
              </button>
              <button
                type="button"
                className={`deficit-tab-btn tab-remittance ${selectedDrawFilter === 'remittance' ? 'active' : ''}`}
                onClick={() => setSelectedDrawFilter('remittance')}
              >
                End-of-Day Remittance
              </button>
            </div>
          </div>

          <div className="deficit-secondary-controls">
            {/* Supervisor Selector */}
            <div className="deficit-control-item">
              <label htmlFor="deficit-spvr-select">Supervisor:</label>
              <select
                id="deficit-spvr-select"
                className="deficit-select"
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
              >
                <option value="all">All Supervisors ({supervisorReports.length})</option>
                {supervisorList.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} {s.count > 0 ? `(${s.count} deficits)` : '(0)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Specific Draw Time drilldown */}
            <div className="deficit-control-item">
              <label htmlFor="deficit-time-select">Specific Time:</label>
              <select
                id="deficit-time-select"
                className="deficit-select"
                value={['morning', 'afternoon', 'evening', 'remittance', 'all'].includes(selectedDrawFilter) ? '' : selectedDrawFilter}
                onChange={(e) => {
                  if (e.target.value) setSelectedDrawFilter(e.target.value)
                }}
              >
                <option value="">By Draw Time...</option>
                {allDrawTimes.map((t) => (
                  <option key={t} value={t}>
                    Draw {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="deficit-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search agent or supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="deficit-view-toggle">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                onClick={() => setViewMode('grouped')}
                title="Group records by Supervisor"
              >
                By Supervisor
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'flat' ? 'active' : ''}`}
                onClick={() => setViewMode('flat')}
                title="Unified Flat Ranking Table"
              >
                Flat Table
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="deficit-modal-body">
          {filteredRecords.length === 0 ? (
            <div className="deficit-empty-state">
              <div className="deficit-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3>No Negative Deficits Found</h3>
              <p>
                {searchQuery || selectedSupervisor !== 'all' || selectedDrawFilter !== 'all'
                  ? 'No tellers match the selected draw, supervisor, or search filters.'
                  : 'All active agents have positive remittance balances for the selected date.'}
              </p>
              {(searchQuery || selectedSupervisor !== 'all' || selectedDrawFilter !== 'all') && (
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={() => {
                    setSelectedDrawFilter('all')
                    setSelectedSupervisor('all')
                    setSearchQuery('')
                  }}
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : viewMode === 'grouped' ? (
            /* Grouped by Supervisor View */
            <div className="deficit-groups-list">
              {groupedBySupervisor.map((group) => (
                <div key={group.supervisor} className="deficit-spvr-card">
                  <div className="deficit-spvr-header">
                    <div className="deficit-spvr-info">
                      <span className="spvr-avatar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </span>
                      <div>
                        <strong className="spvr-name">{group.supervisor}</strong>
                        <span className="spvr-meta">
                          {group.uniqueAgents.size} tellers in deficit • {group.records.length} negative records
                        </span>
                      </div>
                    </div>
                    <div className="deficit-spvr-subtotal">
                      <small>Supervisor Deficit Subtotal:</small>
                      <strong className="deficit-pill-large">
                        ({formatCurrency(group.totalDeficit)})
                      </strong>
                    </div>
                  </div>

                  <div className="deficit-table-wrap">
                    <table className="deficit-data-table">
                      <thead>
                        <tr>
                          <th>AGENT / TELLER NAME</th>
                          <th>DRAW ROTATION</th>
                          <th className="num-col">GROSS</th>
                          <th className="num-col">HITS</th>
                          <th className="num-col">COMMISSION</th>
                          <th className="num-col highlight-col">NEGATIVE DEFICIT</th>
                          <th>SEVERITY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map((record) => {
                          const isHigh = record.deficit >= 10000
                          const isModerate = record.deficit >= 3000 && record.deficit < 10000
                          return (
                            <tr key={record.id} className="deficit-row">
                              <td className="agent-cell">
                                <span className="agent-name-main">{record.agentName}</span>
                                <span className="agent-key-sub">{record.agentKey}</span>
                              </td>
                              <td className="draw-cell">
                                <span className={`draw-badge badge-${record.drawKey}`}>
                                  {record.drawTitle}
                                </span>
                                <span className="draw-sub-sched">{record.drawSchedule}</span>
                              </td>
                              <td className="num-col">{formatAmount(record.gross)}</td>
                              <td className="num-col hits-text">{formatAmount(record.hits)}</td>
                              <td className="num-col">
                                {record.commission > 0 ? (
                                  <>
                                    {formatAmount(record.commission)}
                                    {record.commissionRate && (
                                      <small className="comm-rate-sub">({record.commissionRate}%)</small>
                                    )}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="num-col highlight-col">
                                <span className="deficit-amount-badge">
                                  ({formatCurrency(record.deficit)})
                                </span>
                              </td>
                              <td>
                                {isHigh ? (
                                  <span className="severity-badge sev-critical">CRITICAL</span>
                                ) : isModerate ? (
                                  <span className="severity-badge sev-elevated">ELEVATED</span>
                                ) : (
                                  <span className="severity-badge sev-normal">STANDARD</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Flat Ranking Table View */
            <div className="deficit-flat-table-wrap">
              <table className="deficit-data-table flat-table">
                <thead>
                  <tr>
                    <th>RANK</th>
                    <th>AGENT / TELLER</th>
                    <th>SUPERVISOR</th>
                    <th>DRAW / CATEGORY</th>
                    <th className="num-col">GROSS</th>
                    <th className="num-col">HITS</th>
                    <th className="num-col">COMMISSION</th>
                    <th className="num-col highlight-col">NEGATIVE DEFICIT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, index) => {
                    const isHigh = record.deficit >= 10000
                    return (
                      <tr key={record.id} className="deficit-row">
                        <td className="rank-cell">
                          <span className={`rank-badge ${index < 3 ? 'top-rank' : ''}`}>
                            #{index + 1}
                          </span>
                        </td>
                        <td className="agent-cell">
                          <strong className="agent-name-main">{record.agentName}</strong>
                        </td>
                        <td className="spvr-cell">{record.supervisor}</td>
                        <td className="draw-cell">
                          <span className={`draw-badge badge-${record.drawKey}`}>
                            {record.drawTitle}
                          </span>
                        </td>
                        <td className="num-col">{formatAmount(record.gross)}</td>
                        <td className="num-col hits-text">{formatAmount(record.hits)}</td>
                        <td className="num-col">
                          {record.commission > 0 ? formatAmount(record.commission) : '—'}
                        </td>
                        <td className="num-col highlight-col">
                          <strong className="deficit-amount-badge">
                            ({formatCurrency(record.deficit)})
                          </strong>
                        </td>
                        <td>
                          {isHigh ? (
                            <span className="severity-badge sev-critical">CRITICAL</span>
                          ) : (
                            <span className="severity-badge sev-normal">DEFICIT</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="deficit-modal-footer">
          <div className="footer-left">
            <span>
              Showing <strong>{filteredRecords.length}</strong> deficit records for{' '}
              <strong>{summaryMetrics.uniqueCount}</strong> tellers in <strong>{branchName}</strong>
            </span>
          </div>
          <div className="footer-right">
            <button type="button" className="footer-close-btn" onClick={onClose}>
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalNode, document.body)
}
