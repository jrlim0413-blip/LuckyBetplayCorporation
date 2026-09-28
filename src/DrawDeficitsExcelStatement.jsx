import React, { useMemo } from 'react'
import './DrawDeficitsExcelStatement.css'

function formatExcelDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatNegativeNum(val) {
  const num = Math.abs(Math.round(Number(val) || 0))
  if (num === 0) return '-'
  return `(${num.toLocaleString('en-US')})`
}

function formatCurrencyTotal(val) {
  const num = Math.abs(Math.round(Number(val) || 0))
  return `(₱ ${num.toLocaleString('en-US')})`
}

export function calculateAgentDrawDeficit(agent, drawKey) {
  if (!agent) return 0

  if (drawKey === 'morning') {
    // 1st Draw: 10:30 AM + 2:00 PM
    const g1 = (agent.draws instanceof Map ? agent.draws.get('10:30 AM')?.gross : agent.draws?.['10:30 AM']?.gross) || 0
    const g2 = (agent.draws instanceof Map ? agent.draws.get('2:00 PM')?.gross : agent.draws?.['2:00 PM']?.gross) || 0
    const h1 = (agent.draws instanceof Map ? agent.draws.get('10:30 AM')?.hits : agent.draws?.['10:30 AM']?.hits) || 0
    const h2 = (agent.draws instanceof Map ? agent.draws.get('2:00 PM')?.hits : agent.draws?.['2:00 PM']?.hits) || 0
    const net = (Number(g1) + Number(g2)) - (Number(h1) + Number(h2))
    return net < 0 ? Math.abs(net) : 0
  }

  if (drawKey === 'afternoon') {
    // 2nd Draw: 3:00 PM + 5:00 PM with 1st draw positive carryover
    const g1 = (agent.draws instanceof Map ? agent.draws.get('10:30 AM')?.gross : agent.draws?.['10:30 AM']?.gross) || 0
    const g2 = (agent.draws instanceof Map ? agent.draws.get('2:00 PM')?.gross : agent.draws?.['2:00 PM']?.gross) || 0
    const h1 = (agent.draws instanceof Map ? agent.draws.get('10:30 AM')?.hits : agent.draws?.['10:30 AM']?.hits) || 0
    const h2 = (agent.draws instanceof Map ? agent.draws.get('2:00 PM')?.hits : agent.draws?.['2:00 PM']?.hits) || 0
    const net1 = (Number(g1) + Number(g2)) - (Number(h1) + Number(h2))
    const carry1 = Math.max(0, net1)

    const g3 = (agent.draws instanceof Map ? agent.draws.get('3:00 PM')?.gross : agent.draws?.['3:00 PM']?.gross) || 0
    const g4 = (agent.draws instanceof Map ? agent.draws.get('5:00 PM')?.gross : agent.draws?.['5:00 PM']?.gross) || 0
    const h3 = (agent.draws instanceof Map ? agent.draws.get('3:00 PM')?.hits : agent.draws?.['3:00 PM']?.hits) || 0
    const h4 = (agent.draws instanceof Map ? agent.draws.get('5:00 PM')?.hits : agent.draws?.['5:00 PM']?.hits) || 0
    const net2 = (carry1 + Number(g3) + Number(g4)) - (Number(h3) + Number(h4))
    return net2 < 0 ? Math.abs(net2) : 0
  }

  if (drawKey === 'evening') {
    // 3rd Draw: 7:00 PM + 9:00 PM with 2nd draw positive carryover
    const g1 = (agent.draws instanceof Map ? agent.draws.get('10:30 AM')?.gross : agent.draws?.['10:30 AM']?.gross) || 0
    const g2 = (agent.draws instanceof Map ? agent.draws.get('2:00 PM')?.gross : agent.draws?.['2:00 PM']?.gross) || 0
    const h1 = (agent.draws instanceof Map ? agent.draws.get('10:30 AM')?.hits : agent.draws?.['10:30 AM']?.hits) || 0
    const h2 = (agent.draws instanceof Map ? agent.draws.get('2:00 PM')?.hits : agent.draws?.['2:00 PM']?.hits) || 0
    const net1 = (Number(g1) + Number(g2)) - (Number(h1) + Number(h2))
    const carry1 = Math.max(0, net1)

    const g3 = (agent.draws instanceof Map ? agent.draws.get('3:00 PM')?.gross : agent.draws?.['3:00 PM']?.gross) || 0
    const g4 = (agent.draws instanceof Map ? agent.draws.get('5:00 PM')?.gross : agent.draws?.['5:00 PM']?.gross) || 0
    const h3 = (agent.draws instanceof Map ? agent.draws.get('3:00 PM')?.hits : agent.draws?.['3:00 PM']?.hits) || 0
    const h4 = (agent.draws instanceof Map ? agent.draws.get('5:00 PM')?.hits : agent.draws?.['5:00 PM']?.hits) || 0
    const net2 = (carry1 + Number(g3) + Number(g4)) - (Number(h3) + Number(h4))
    const carry2 = Math.max(0, net2)

    const g5 = (agent.draws instanceof Map ? agent.draws.get('7:00 PM')?.gross : agent.draws?.['7:00 PM']?.gross) || 0
    const g6 = (agent.draws instanceof Map ? agent.draws.get('9:00 PM')?.gross : agent.draws?.['9:00 PM']?.gross) || 0
    const h5 = (agent.draws instanceof Map ? agent.draws.get('7:00 PM')?.hits : agent.draws?.['7:00 PM']?.hits) || 0
    const h6 = (agent.draws instanceof Map ? agent.draws.get('9:00 PM')?.hits : agent.draws?.['9:00 PM']?.hits) || 0
    const net3 = (carry2 + Number(g5) + Number(g6)) - (Number(h5) + Number(h6))
    return net3 < 0 ? Math.abs(net3) : 0
  }

  // Remittance: Net Sales (Gross - Hits - Commission)
  const gross = Number(agent.totalGross) || 0
  const hits = Number(agent.totalHits) || 0
  const comm = agent.totalSalary !== undefined ? Number(agent.totalSalary) : gross * ((agent.commissionRate || 10) / 100)
  const netSales = gross - hits - comm
  return netSales < 0 ? Math.abs(netSales) : 0
}

const ALL_DRAWS_CONFIG = [
  { key: 'morning', title: '1ST DRAW', subtext: '10:30 AM & 2:00 PM' },
  { key: 'afternoon', title: '2ND DRAW', subtext: '3:00 PM & 5:00 PM' },
  { key: 'evening', title: '3RD DRAW', subtext: '7:00 PM & 9:00 PM' },
  { key: 'remittance', title: 'NET REMITTANCE DEFICITS', subtext: 'Final Net Remittance' },
]

export default function DrawDeficitsExcelStatement({
  group,
  allSupervisors = [],
  selectedDate,
}) {
  const isConsolidated = group?.supervisor === 'ALL SUPERVISORS (CONSOLIDATED)'

  // Extract deficits for each draw across supervisor(s)
  const drawsData = useMemo(() => {
    const rawGroups = (isConsolidated && allSupervisors && allSupervisors.length > 0)
      ? allSupervisors
      : [group || { supervisor: 'SUPERVISOR 1', agents: [] }]

    return ALL_DRAWS_CONFIG.map((drawConf) => {
      const supervisorResults = rawGroups.map((s) => {
        const deficitAgents = (s.agents || []).map((agent) => {
          const deficit = calculateAgentDrawDeficit(agent, drawConf.key)
          return {
            teller: agent.teller,
            key: agent.key || agent.teller,
            deficit,
          }
        }).filter((a) => a.deficit > 0)

        const totalDeficit = deficitAgents.reduce((sum, a) => sum + a.deficit, 0)

        return {
          supervisor: s.supervisor,
          agents: deficitAgents,
          totalDeficit,
        }
      })

      const totalDeficitDraw = supervisorResults.reduce((sum, s) => sum + s.totalDeficit, 0)
      const totalCountDraw = supervisorResults.reduce((sum, s) => sum + s.agents.length, 0)

      // Single Supervisor Data
      let singleSupervisorData = null
      if (!isConsolidated) {
        const spvr = supervisorResults[0] || { supervisor: group?.supervisor || 'SUPERVISOR 1', agents: [], totalDeficit: 0 }
        singleSupervisorData = {
          supervisor: spvr.supervisor,
          totalDeficit: spvr.totalDeficit,
          totalCount: spvr.agents.length,
          agents: spvr.agents,
        }
      }

      return {
        ...drawConf,
        supervisorResults,
        totalDeficitDraw,
        totalCountDraw,
        singleSupervisorData,
      }
    })
  }, [group, allSupervisors, isConsolidated])

  const formattedDate = formatExcelDate(selectedDate)

  const renderTellerContent = (teller) => {
    if (!teller) return '\u00A0'
    const parts = teller.split(' - ')
    return <strong className="modern-teller-main" title={teller}>{parts[0]}</strong>
  }

  return (
    <div className="modern-roster-document">
      {/* ALL DRAWS RENDERED WITH SINGLE-COLUMN AGENTS + TOTAL NEGATIVE PER DRAW */}
      <div className="modern-draws-container">
        {drawsData.map((drawItem) => (
          <div key={`draw-block-${drawItem.key}`} className="modern-draw-card">
            {/* Draw Red Banner with Total Negative Highlight */}
            <div className="modern-draw-banner">
              <div className="modern-draw-title-left">
                <span className="draw-title-badge">{drawItem.title}</span>
                <span className="draw-subtext-badge">({drawItem.subtext})</span>
                {drawItem.totalDeficitDraw > 0 && (
                  <span className="draw-header-total-badge">
                    Total Negative: <strong>{formatCurrencyTotal(drawItem.totalDeficitDraw)}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* SINGLE SUPERVISOR (Single Column Agent List + Total Negative Row) */}
            {!isConsolidated && drawItem.singleSupervisorData && (
              <div className="modern-roster-body">
                {drawItem.singleSupervisorData.totalCount === 0 ? (
                  <div className="modern-clean-draw-notice">
                    <span className="clean-check">✓</span>
                    <span className="clean-msg">
                      No negative deficits in <strong>{drawItem.title}</strong> for {drawItem.singleSupervisorData.supervisor} — TOTAL NEGATIVE: ₱ 0
                    </span>
                  </div>
                ) : (
                  <table className="modern-single-col-table">
                    <thead>
                      <tr className="modern-draw-th-row">
                        <th className="modern-th-agent">
                          <span>AGENT / TELLER - NEGATIVE</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawItem.singleSupervisorData.agents.map((agent, aIdx) => (
                        <tr key={`r-${drawItem.key}-${aIdx}`} className="modern-tr tr-data">
                          <td className="modern-td-name">
                            <div className="modern-td-detail">
                              <span className="modern-td-agent-label">{renderTellerContent(agent.teller)}</span>
                            <span className="modern-amount-text">
                              {formatNegativeNum(agent.deficit)}
                            </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {/* Total Negative Every Draw */}
                      <tr className="modern-draw-total-row">
                        <td className="modern-draw-total-label">
                          <div className="modern-td-detail">
                            <span className="modern-draw-total-copy">
                              <strong>TOTAL NEGATIVE</strong>
                              <span className="modern-total-count">({drawItem.singleSupervisorData.totalCount} {drawItem.singleSupervisorData.totalCount === 1 ? 'teller' : 'tellers'})</span>
                            </span>
                            <strong className="modern-draw-total-amt">{formatCurrencyTotal(drawItem.singleSupervisorData.totalDeficit)}</strong>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* CONSOLIDATED (ALL SUPERVISORS) */}
            {isConsolidated && (
              <div className="modern-roster-body">
                {drawItem.totalCountDraw === 0 ? (
                  <div className="modern-clean-draw-notice">
                    <span className="clean-check">✓</span>
                    <span className="clean-msg">
                      No negative deficits recorded across all supervisors in <strong>{drawItem.title}</strong> — TOTAL NEGATIVE: ₱ 0
                    </span>
                  </div>
                ) : (
                  <table className="modern-single-col-table">
                    <thead>
                      <tr className="modern-draw-th-row">
                        <th className="modern-th-agent">
                          <span>SUPERVISOR &bull; AGENT - NEGATIVE</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawItem.supervisorResults
                        .flatMap((s) => s.agents.map((a) => ({ ...a, supervisor: s.supervisor })))
                        .map((agent, aIdx) => (
                          <tr key={`r-cons-${drawItem.key}-${aIdx}`} className="modern-tr tr-data">
                            <td className="modern-td-name">
                              <div className="modern-td-detail">
                                <span className="modern-td-agent-label">
                                  <span className="modern-spvr-tag">[{agent.supervisor}]</span>{' '}
                                  {renderTellerContent(agent.teller)}
                                </span>
                              <span className="modern-amount-text">
                                {formatNegativeNum(agent.deficit)}
                              </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {/* Consolidated Total Negative Every Draw */}
                      <tr className="modern-draw-total-row">
                        <td className="modern-draw-total-label">
                          <div className="modern-td-detail">
                            <span className="modern-draw-total-copy">
                              <strong>CONSOLIDATED TOTAL</strong>
                              <span className="modern-total-count">({drawItem.totalCountDraw} {drawItem.totalCountDraw === 1 ? 'teller' : 'tellers'})</span>
                            </span>
                            <strong className="modern-draw-total-amt">{formatCurrencyTotal(drawItem.totalDeficitDraw)}</strong>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
