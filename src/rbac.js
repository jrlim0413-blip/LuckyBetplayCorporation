// src/rbac.js - Role-Based Access Control (RBAC) & Credential Store for Lucky Betplay Corporation

const USERS_STORAGE_KEY = 'luckybet_rbac_users'
const ROLES_STORAGE_KEY = 'luckybet_rbac_roles'
const AUDIT_STORAGE_KEY = 'luckybet_rbac_audit_logs'

export const PERMISSIONS = [
  { key: 'view_overview', label: 'Consolidated Overview & KPIs', group: 'Financials' },
  { key: 'view_reports', label: 'Draw Gross & Turnover Matrix', group: 'Financials' },
  { key: 'print_statements', label: 'Print Official Remittance Statements', group: 'Operations' },
  { key: 'manage_users', label: 'Manage User Credentials & RBAC', group: 'Administration' },
  { key: 'audit_logs', label: 'Security & Audit Trail Access', group: 'Security' },
  { key: 'export_data', label: 'Export Data (CSV / JSON)', group: 'Operations' },
]

export const DEFAULT_ROLES = {
  admin: {
    key: 'admin',
    label: 'System Administrator',
    badge: 'Super Admin',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    description: 'Unrestricted full access across accounting, reports, user configuration, and audit security.',
    permissions: ['view_overview', 'view_reports', 'print_statements', 'manage_users', 'audit_logs', 'export_data'],
  },
  accountant: {
    key: 'accountant',
    label: 'Head Accountant',
    badge: 'Auditing Officer',
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    description: 'Audits daily 3-draw rotation matrices, reviews supervisor balance sheets, and prints statements.',
    permissions: ['view_overview', 'view_reports', 'print_statements', 'export_data'],
  },
  supervisor: {
    key: 'supervisor',
    label: 'Branch Supervisor',
    badge: 'Area Lead',
    color: '#facc15',
    bgColor: 'rgba(250, 204, 21, 0.15)',
    borderColor: 'rgba(250, 204, 21, 0.35)',
    description: 'Monitors assigned terminal agents, checks remittance ledger, and tracks draw turnover.',
    permissions: ['view_overview', 'view_reports'],
  },
  staff: {
    key: 'staff',
    label: 'Terminal Staff',
    badge: 'Read Only',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
    description: 'Operational terminal assistant with access restricted to live overview metrics.',
    permissions: ['view_overview'],
  },
}

export const DEFAULT_USERS = [
  {
    id: 'usr_admin',
    username: 'admin',
    password: 'adminpassword',
    name: 'Jay Ryan Lim',
    role: 'admin',
    roleLabel: 'System Administrator',
    branch: 'Mandaue HQ (All Zones)',
    status: 'active',
    lastLogin: 'Active Now',
    createdAt: '2026-01-15',
    avatar: 'JL',
    email: 'admin@luckybetplay.ph',
  },
  {
    id: 'usr_accountant',
    username: 'mandaue.staff',
    password: 'luckybet2026',
    name: 'Elena Morales',
    role: 'accountant',
    roleLabel: 'Head Accountant',
    branch: 'Mandaue Branch',
    status: 'active',
    lastLogin: 'Today, 09:15 AM',
    createdAt: '2026-02-01',
    avatar: 'EM',
    email: 'elena.m@luckybetplay.ph',
  },
  {
    id: 'usr_supervisor',
    username: 'supervisor.carlos',
    password: 'luckybet2026',
    name: 'Carlos Tan',
    role: 'supervisor',
    roleLabel: 'Branch Supervisor',
    branch: 'Mandaue Central Zone',
    status: 'active',
    lastLogin: 'Yesterday, 04:30 PM',
    createdAt: '2026-02-10',
    avatar: 'CT',
    email: 'carlos.tan@luckybetplay.ph',
  },
  {
    id: 'usr_terminal',
    username: 'teller.mandaue',
    password: 'luckybet2026',
    name: 'Rico Dela Cruz',
    role: 'staff',
    roleLabel: 'Terminal Staff',
    branch: 'Mandaue Terminal 01',
    status: 'active',
    lastLogin: '3 days ago',
    createdAt: '2026-02-20',
    avatar: 'RD',
    email: 'rico.staff@luckybetplay.ph',
  },
]

export const DEFAULT_AUDIT_LOGS = [
  {
    id: 'log_01',
    timestamp: 'Today, 09:30 AM',
    action: 'SESSION_AUTHENTICATION',
    actor: 'admin',
    details: 'System Administrator authenticated from 256-bit SSL Gateway',
    severity: 'info',
  },
  {
    id: 'log_02',
    timestamp: 'Today, 08:45 AM',
    action: 'RBAC_CREDENTIAL_VERIFIED',
    actor: 'mandaue.staff',
    details: 'Accounting credentials verified for Mandaue draw turnover',
    severity: 'success',
  },
  {
    id: 'log_03',
    timestamp: 'Yesterday, 09:00 PM',
    action: 'DRAW_RECONCILIATION',
    actor: 'system',
    details: 'Evening 7:00 PM & 9:00 PM draw matrix balanced at 99.98% accuracy',
    severity: 'info',
  },
]

// -----------------------------------------------------------------------------
// Storage Accessors
// -----------------------------------------------------------------------------
const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined'

export function getRbacRoles() {
  if (!isBrowser) return DEFAULT_ROLES
  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to parse roles from localStorage:', err)
  }
  return DEFAULT_ROLES
}

export function saveRbacRoles(roles) {
  if (!isBrowser) return
  try {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles))
  } catch (err) {
    console.error('Failed to save roles to localStorage:', err)
  }
}

const DELETED_USERS_KEY = 'luckybet_rbac_deleted_users'

export function getDeletedUsernames() {
  if (!isBrowser) return []
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export function recordDeletedUsername(username) {
  if (!isBrowser || !username) return
  try {
    const list = getDeletedUsernames()
    const clean = username.trim().toLowerCase()
    if (!list.includes(clean)) {
      list.push(clean)
      localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(list))
    }
  } catch {}
}

export function unmarkDeletedUsername(username) {
  if (!isBrowser || !username) return
  try {
    const list = getDeletedUsernames().filter((u) => u !== username.trim().toLowerCase())
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(list))
  } catch {}
}

export function getRbacUsers() {
  if (!isBrowser) return DEFAULT_USERS
  const deleted = getDeletedUsernames()

  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((u) => !deleted.includes(u.username.toLowerCase()))
      }
    }
  } catch (err) {
    console.warn('Failed to parse users from localStorage:', err)
  }

  // Initialize default users if not set, omitting any deleted ones
  const initial = DEFAULT_USERS.filter((u) => !deleted.includes(u.username.toLowerCase()))
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial))
  } catch {}
  return initial
}

export function saveRbacUsers(users) {
  if (!isBrowser) return
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  } catch (err) {
    console.error('Failed to save users to localStorage:', err)
  }
}

export function getAuditLogs() {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return DEFAULT_AUDIT_LOGS
}

export function addAuditLog(action, details, actor = 'current_user', severity = 'info') {
  try {
    const logs = getAuditLogs()
    const now = new Date()
    const timeStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    const newEntry = {
      id: `log_${Date.now()}`,
      timestamp: timeStr,
      action,
      actor,
      details,
      severity,
    }
    const updated = [newEntry, ...logs].slice(0, 50)
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return []
  }
}

// -----------------------------------------------------------------------------
// Authentication & RBAC Verification (Strict Directory Matching)
// -----------------------------------------------------------------------------
export function verifyUserCredentials(username, password) {
  const users = getRbacUsers()
  const cleanUser = String(username || '').trim().toLowerCase()
  const cleanPass = String(password || '').trim()

  const deleted = getDeletedUsernames()
  if (deleted.includes(cleanUser)) {
    return null
  }

  // Check if account exists but is deactivated
  const userRecord = users.find((u) => u.username.toLowerCase() === cleanUser)
  if (userRecord && (userRecord.status === 'suspended' || userRecord.status === 'inactive')) {
    if (userRecord.password === cleanPass) {
      return { deactivated: true, username: userRecord.username }
    }
  }

  // Strict check: Account MUST exist in directory, be active, and password MUST match exactly
  const match = users.find(
    (u) =>
      u.status === 'active' &&
      u.username.toLowerCase() === cleanUser &&
      u.password === cleanPass
  )

  if (match) {
    const roles = getRbacRoles()
    const roleDef = roles[match.role] || DEFAULT_ROLES[match.role] || DEFAULT_ROLES.staff
    return {
      id: match.id,
      username: match.username,
      name: match.name,
      role: match.role,
      roleLabel: roleDef.label,
      roleBadge: roleDef.badge,
      permissions: roleDef.permissions || [],
      branch: match.branch,
      avatar: match.avatar || match.name.substring(0, 2).toUpperCase(),
      email: match.email,
      loginTime: new Date().toISOString(),
      token: 'rbac-token-' + match.id,
    }
  }

  return null
}

export function hasPermission(currentUser, permKey) {
  if (!currentUser) return false
  if (currentUser.role === 'admin') return true
  const roles = getRbacRoles()
  const roleDef = roles[currentUser.role] || DEFAULT_ROLES[currentUser.role]
  if (!roleDef) return false
  return roleDef.permissions.includes(permKey)
}
