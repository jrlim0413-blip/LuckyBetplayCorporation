// src/commissions.js - Hierarchical Commission Store & Calculation Service for Lucky Betplay Corporation

const COMMISSIONS_STORAGE_KEY = 'luckybet_commission_settings'

export const DEFAULT_COMMISSION_CONFIG = {
  globalDefaultRate: 10.0, // Baseline 10%
  supervisors: {},
}

/**
 * Loads commission settings from localStorage with fallbacks
 */
export function loadCommissionSettings() {
  try {
    const raw = localStorage.getItem(COMMISSIONS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_COMMISSION_CONFIG }
    const parsed = JSON.parse(raw)
    return {
      globalDefaultRate: Number(parsed.globalDefaultRate) || 10.0,
      supervisors: parsed.supervisors && typeof parsed.supervisors === 'object' ? parsed.supervisors : {},
    }
  } catch (err) {
    console.error('Failed to load commission settings:', err)
    return { ...DEFAULT_COMMISSION_CONFIG }
  }
}

/**
 * Saves commission settings and triggers cross-tab/cross-component update event
 */
export function saveCommissionSettings(settings) {
  try {
    const payload = {
      globalDefaultRate: Number(settings.globalDefaultRate) || 10.0,
      supervisors: settings.supervisors || {},
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(COMMISSIONS_STORAGE_KEY, JSON.stringify(payload))
    window.dispatchEvent(new CustomEvent('luckybet_commissions_updated', { detail: payload }))
    return true
  } catch (err) {
    console.error('Failed to save commission settings:', err)
    return false
  }
}

/**
 * Resolves effective commission rate for an agent under a given supervisor
 * Priority: Agent Override > Supervisor Default > Global Default (10%)
 */
export function getAgentCommissionRate(supervisorName, agentKey, settings = null) {
  const currentSettings = settings || loadCommissionSettings()
  const globalDefault = Number(currentSettings.globalDefaultRate) || 10.0
  const spvrKey = String(supervisorName || '').trim().toUpperCase()
  const agtKey = String(agentKey || '').trim().toUpperCase()

  const spvrConfig = currentSettings.supervisors?.[spvrKey]
  const spvrDefault = spvrConfig && spvrConfig.defaultRate !== undefined && spvrConfig.defaultRate !== null
    ? Number(spvrConfig.defaultRate)
    : globalDefault

  // Check for specific agent override
  if (spvrConfig?.agentOverrides && spvrConfig.agentOverrides[agtKey] !== undefined && spvrConfig.agentOverrides[agtKey] !== null) {
    const overrideRate = Number(spvrConfig.agentOverrides[agtKey])
    if (!isNaN(overrideRate) && overrideRate >= 0) {
      return {
        rate: overrideRate,
        isOverride: true,
        supervisorDefault: spvrDefault,
        globalDefault,
      }
    }
  }

  // Fallback to supervisor default
  return {
    rate: spvrDefault,
    isOverride: false,
    supervisorDefault: spvrDefault,
    globalDefault,
  }
}

/**
 * Updates default commission rate for a supervisor
 */
export function updateSupervisorDefaultRate(supervisorName, newRate, currentSettings = null) {
  const settings = currentSettings ? { ...currentSettings } : loadCommissionSettings()
  const spvrKey = String(supervisorName || '').trim().toUpperCase()
  const rateNum = Math.max(0, Math.min(100, Number(newRate) || 0))

  if (!settings.supervisors) settings.supervisors = {}
  if (!settings.supervisors[spvrKey]) {
    settings.supervisors[spvrKey] = {
      defaultRate: rateNum,
      agentOverrides: {},
    }
  } else {
    settings.supervisors[spvrKey] = {
      ...settings.supervisors[spvrKey],
      defaultRate: rateNum,
    }
  }

  saveCommissionSettings(settings)
  return settings
}

/**
 * Sets custom commission override rate for a specific agent under a supervisor
 */
export function setAgentOverride(supervisorName, agentKey, overrideRate, currentSettings = null) {
  const settings = currentSettings ? { ...currentSettings } : loadCommissionSettings()
  const spvrKey = String(supervisorName || '').trim().toUpperCase()
  const agtKey = String(agentKey || '').trim().toUpperCase()
  const rateNum = Math.max(0, Math.min(100, Number(overrideRate) || 0))

  if (!settings.supervisors) settings.supervisors = {}
  if (!settings.supervisors[spvrKey]) {
    settings.supervisors[spvrKey] = {
      defaultRate: settings.globalDefaultRate || 10.0,
      agentOverrides: { [agtKey]: rateNum },
    }
  } else {
    const existingOverrides = settings.supervisors[spvrKey].agentOverrides || {}
    settings.supervisors[spvrKey] = {
      ...settings.supervisors[spvrKey],
      agentOverrides: {
        ...existingOverrides,
        [agtKey]: rateNum,
      },
    }
  }

  saveCommissionSettings(settings)
  return settings
}

/**
 * Removes agent override and reverts agent to supervisor's default rate
 */
export function removeAgentOverride(supervisorName, agentKey, currentSettings = null) {
  const settings = currentSettings ? { ...currentSettings } : loadCommissionSettings()
  const spvrKey = String(supervisorName || '').trim().toUpperCase()
  const agtKey = String(agentKey || '').trim().toUpperCase()

  if (settings.supervisors?.[spvrKey]?.agentOverrides) {
    const updatedOverrides = { ...settings.supervisors[spvrKey].agentOverrides }
    delete updatedOverrides[agtKey]
    settings.supervisors[spvrKey] = {
      ...settings.supervisors[spvrKey],
      agentOverrides: updatedOverrides,
    }
    saveCommissionSettings(settings)
  }

  return settings
}

/**
 * Resets all overrides for a supervisor
 */
export function resetSupervisorOverrides(supervisorName, currentSettings = null) {
  const settings = currentSettings ? { ...currentSettings } : loadCommissionSettings()
  const spvrKey = String(supervisorName || '').trim().toUpperCase()

  if (settings.supervisors?.[spvrKey]) {
    settings.supervisors[spvrKey] = {
      ...settings.supervisors[spvrKey],
      agentOverrides: {},
    }
    saveCommissionSettings(settings)
  }

  return settings
}
