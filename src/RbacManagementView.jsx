import { useState, useMemo, useEffect } from 'react'
import './RbacManagementView.css'
import {
  getRbacUsers,
  saveRbacUsers,
  getRbacRoles,
  saveRbacRoles,
  PERMISSIONS,
  DEFAULT_ROLES,
  getAuditLogs,
  addAuditLog,
  getDeletedUsernames,
  recordDeletedUsername,
  unmarkDeletedUsername,
} from './rbac'
import {
  isSupabaseConfigured,
  getSupabaseRbacUsers,
  saveRbacUserToSupabase,
  deleteRbacUserFromSupabase,
} from './supabase'

const SQL_SCRIPT_TEXT = `-- Dedicated rbac_users table in Supabase
CREATE TABLE IF NOT EXISTS public.rbac_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  role_label TEXT,
  branch TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  avatar TEXT,
  email TEXT,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rbac_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access to rbac_users" ON public.rbac_users;
CREATE POLICY "Allow anon full access to rbac_users"
ON public.rbac_users
FOR ALL
USING (true)
WITH CHECK (true);

INSERT INTO public.rbac_users (id, username, password, name, role, role_label, branch, status, avatar, email)
VALUES
  ('usr_admin', 'admin', 'adminpassword', 'Jay Ryan Lim', 'admin', 'System Administrator', 'Mandaue HQ (All Zones)', 'active', 'JL', 'admin@luckybetplay.ph'),
  ('usr_accountant', 'mandaue.staff', 'luckybet2026', 'Elena Morales', 'accountant', 'Head Accountant', 'Mandaue Branch', 'active', 'EM', 'elena.m@luckybetplay.ph'),
  ('usr_supervisor', 'supervisor.carlos', 'luckybet2026', 'Carlos Tan', 'supervisor', 'Branch Supervisor', 'Mandaue Central Zone', 'active', 'CT', 'carlos.tan@luckybetplay.ph'),
  ('usr_terminal', 'teller.mandaue', 'luckybet2026', 'Rico Dela Cruz', 'staff', 'Terminal Staff', 'Mandaue Terminal 01', 'active', 'RD', 'rico.staff@luckybetplay.ph')
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  role_label = EXCLUDED.role_label,
  branch = EXCLUDED.branch,
  status = EXCLUDED.status;`

function SvgIcon({ name, size = 16, className = '' }) {
  const icons = {
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    userPlus: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </>
    ),
    shieldCheck: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    key: (
      <>
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m21 2-9.6 9.6" />
        <path d="m15.5 7.5 3 3L22 7l-3-3" />
      </>
    ),
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    edit: (
      <>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </>
    ),
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    check: (
      <polyline points="20 6 9 17 4 12" />
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.7-3L3 11" />
        <path d="M3 5v6h6" />
        <path d="M4 13a8 8 0 0 0 14.7 3L21 13" />
        <path d="M21 19v-6h-6" />
      </>
    ),
    logIn: (
      <>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </>
    ),
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    activity: (
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    ),
  }

  return (
    <svg
      className={`ui-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.shieldCheck}
    </svg>
  )
}

export default function RbacManagementView({ currentUser, onSimulateUser, branchName = 'Mandaue' }) {
  const [users, setUsers] = useState(() => getRbacUsers())
  const [roles, setRoles] = useState(() => getRbacRoles())
  const [auditLogs, setAuditLogs] = useState(() => getAuditLogs())
  const [activeTab, setActiveTab] = useState('users') // 'users' | 'matrix' | 'logs'

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedbackNotice, setFeedbackNotice] = useState('')
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState('idle') // 'idle' | 'syncing' | 'connected' | 'table_missing' | 'error'
  const [showSqlModal, setShowSqlModal] = useState(false)

  // Fetch users from Supabase table on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return

    setSupabaseSyncStatus('syncing')
    getSupabaseRbacUsers()
      .then((res) => {
        const deletedList = getDeletedUsernames()
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          // Filter out any user that was previously marked as deleted
          const validUsers = res.data.filter(
            (u) => !deletedList.includes(u.username?.toLowerCase())
          )
          setUsers(validUsers)
          saveRbacUsers(validUsers)
          setSupabaseSyncStatus('connected')

          // Background cleanup of any lingering deleted accounts still in Supabase
          const lingering = res.data.filter((u) =>
            deletedList.includes(u.username?.toLowerCase())
          )
          lingering.forEach((u) => {
            deleteRbacUserFromSupabase(u.id, u.username).catch(() => {})
          })
        } else if (res.tableMissing) {
          setSupabaseSyncStatus('table_missing')
        } else if (res.success && res.data.length === 0) {
          setSupabaseSyncStatus('connected')
          // Auto-seed default users only if not in deleted list
          const activeDefaults = users.filter(
            (u) => !deletedList.includes(u.username?.toLowerCase())
          )
          activeDefaults.forEach((u) => saveRbacUserToSupabase(u).catch(() => {}))
        } else {
          setSupabaseSyncStatus('connected')
        }
      })
      .catch(() => {
        setSupabaseSyncStatus('error')
      })
  }, [])

  // New User Form State
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    role: 'accountant',
    branch: `${branchName} Branch`,
    status: 'active',
    email: '',
  })

  const showNotification = (msg) => {
    setFeedbackNotice(msg)
    setTimeout(() => setFeedbackNotice(''), 3500)
  }

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.branch && u.branch.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesRole = filterRole === 'all' || u.role === filterRole
      return matchesSearch && matchesRole
    })
  }, [users, searchQuery, filterRole])

  // Generate random password helper
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
    let generated = 'LB-'
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData((prev) => ({ ...prev, password: generated }))
  }

  // Handle Add User
  const handleCreateUser = (e) => {
    e.preventDefault()
    const cleanUser = formData.username.trim().toLowerCase()
    const cleanName = formData.name.trim()
    const cleanPass = formData.password.trim()

    if (!cleanUser || !cleanName || !cleanPass) {
      alert('Please fill out Username, Full Name, and Password.')
      return
    }

    if (users.some((u) => u.username.toLowerCase() === cleanUser)) {
      alert(`Username "${cleanUser}" already exists. Please choose a different Access ID.`)
      return
    }

    const roleDef = roles[formData.role] || DEFAULT_ROLES[formData.role] || DEFAULT_ROLES.staff
    const newUser = {
      id: `usr_${Date.now()}`,
      username: cleanUser,
      name: cleanName,
      password: cleanPass,
      role: formData.role,
      roleLabel: roleDef.label,
      branch: formData.branch || `${branchName} Branch`,
      status: formData.status,
      lastLogin: 'Never',
      createdAt: new Date().toISOString().split('T')[0],
      avatar: cleanName.substring(0, 2).toUpperCase(),
      email: formData.email.trim() || `${cleanUser}@luckybetplay.ph`,
    }

    // Unmark in case this username was previously deleted
    unmarkDeletedUsername(cleanUser)

    const updated = [newUser, ...users]
    setUsers(updated)
    saveRbacUsers(updated)

    // Save directly to Supabase dedicated table
    if (isSupabaseConfigured) {
      saveRbacUserToSupabase(newUser).catch(() => {})
    }

    // Audit log
    const updatedLogs = addAuditLog(
      'RBAC_USER_CREATED',
      `New user credential ${cleanUser} (${roleDef.label}) created by ${currentUser?.username || 'admin'}`,
      currentUser?.username || 'admin',
      'success'
    )
    setAuditLogs(updatedLogs)

    setIsAddModalOpen(false)
    setFormData({
      username: '',
      name: '',
      password: '',
      role: 'accountant',
      branch: `${branchName} Branch`,
      status: 'active',
      email: '',
    })

    showNotification(`User credential "${cleanUser}" successfully created!`)
  }

  // Handle Edit User
  const handleUpdateUser = (e) => {
    e.preventDefault()
    if (!editingUser) return

    const roleDef = roles[editingUser.role] || DEFAULT_ROLES[editingUser.role] || DEFAULT_ROLES.staff
    const updated = users.map((u) => {
      if (u.id === editingUser.id) {
        return {
          ...u,
          name: editingUser.name.trim(),
          role: editingUser.role,
          roleLabel: roleDef.label,
          branch: editingUser.branch.trim(),
          status: editingUser.status,
          password: editingUser.password.trim(),
          email: editingUser.email.trim(),
        }
      }
      return u
    })

    setUsers(updated)
    saveRbacUsers(updated)

    const updatedUser = updated.find((u) => u.id === editingUser.id)
    if (updatedUser && isSupabaseConfigured) {
      saveRbacUserToSupabase(updatedUser).catch(() => {})
    }

    const updatedLogs = addAuditLog(
      'RBAC_USER_UPDATED',
      `Credential for ${editingUser.username} updated to ${roleDef.label} (${editingUser.status})`,
      currentUser?.username || 'admin',
      'info'
    )
    setAuditLogs(updatedLogs)

    setEditingUser(null)
    showNotification(`Credentials for "${editingUser.username}" saved!`)
  }

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser || isDeleting) return
    if (deletingUser.username === 'admin') {
      alert('Security policy prevents deleting the root System Administrator account.')
      setDeletingUser(null)
      return
    }

    const targetUser = deletingUser
    const cleanUser = targetUser.username.trim().toLowerCase()
    setIsDeleting(true)

    try {
      // 1. Immediately blacklist in persistent deleted list so localStorage never resurrects it
      recordDeletedUsername(cleanUser)

      // 2. Remove from active state and local cache
      const updated = users.filter((u) => u.id !== targetUser.id && u.username.toLowerCase() !== cleanUser)
      setUsers(updated)
      saveRbacUsers(updated)

      // 3. Delete permanently from Supabase dedicated table
      if (isSupabaseConfigured) {
        const delRes = await deleteRbacUserFromSupabase(targetUser.id, targetUser.username)
        if (!delRes.success) {
          console.warn('Supabase delete warning:', delRes.error)
        }
      }

      // 4. Audit log
      const updatedLogs = addAuditLog(
        'RBAC_USER_DELETED',
        `Account ${cleanUser} was permanently deleted by ${currentUser?.username || 'admin'}`,
        currentUser?.username || 'admin',
        'warning'
      )
      setAuditLogs(updatedLogs)

      showNotification(`User credential "@${cleanUser}" permanently deleted.`)
    } catch (err) {
      console.error('Error deleting user:', err)
      showNotification(`Error deleting user: ${err.message}`)
    } finally {
      setIsDeleting(false)
      setDeletingUser(null)
    }
  }

  // Toggle permission in the matrix
  const handleTogglePermission = (roleKey, permKey) => {
    if (roleKey === 'admin') {
      // Super admin maintains all permissions for security integrity
      return
    }

    const currentRole = roles[roleKey]
    if (!currentRole) return

    const currentPerms = currentRole.permissions || []
    const nextPerms = currentPerms.includes(permKey)
      ? currentPerms.filter((p) => p !== permKey)
      : [...currentPerms, permKey]

    const updatedRoles = {
      ...roles,
      [roleKey]: {
        ...currentRole,
        permissions: nextPerms,
      },
    }

    setRoles(updatedRoles)
    saveRbacRoles(updatedRoles)

    const updatedLogs = addAuditLog(
      'RBAC_PERMISSION_TOGGLED',
      `Role ${currentRole.label}: permission "${permKey}" was ${currentPerms.includes(permKey) ? 'revoked' : 'granted'}`,
      currentUser?.username || 'admin',
      'info'
    )
    setAuditLogs(updatedLogs)

    showNotification(`Updated permissions for ${currentRole.label}.`)
  }

  // Reset Role Matrix to Defaults
  const handleResetRoles = () => {
    if (confirm('Reset role permissions matrix back to default authorized settings?')) {
      setRoles(DEFAULT_ROLES)
      saveRbacRoles(DEFAULT_ROLES)
      showNotification('Role permissions restored to factory defaults.')
    }
  }

  return (
    <div className="rbac-management-view">
      {/* View Header & KPIs */}
      <div className="rbac-header-card">
        <div className="rbac-header-titles">
          <div className="rbac-eyebrow-chip">
            <SvgIcon name="shieldCheck" size={13} />
            <span>ROLE-BASED ACCESS CONTROL &bull; RBAC</span>
          </div>
          <h2>User Credentials &amp; Access Control</h2>
          <p>
            Configure workstation credentials, manage operational privilege tiers, and enforce 256-bit secure access.
          </p>
        </div>

        <div className="rbac-header-actions">
          {isSupabaseConfigured && (
            <button
              type="button"
              className={`rbac-supabase-sync-btn status-${supabaseSyncStatus}`}
              onClick={() => setShowSqlModal(true)}
              title="View Supabase table configuration & SQL schema"
            >
              <span className={`sync-status-dot status-${supabaseSyncStatus}`} />
              <span>
                {supabaseSyncStatus === 'connected'
                  ? 'Supabase Table: Live'
                  : supabaseSyncStatus === 'table_missing'
                  ? 'Setup Supabase Table (SQL)'
                  : 'Supabase Syncing...'}
              </span>
            </button>
          )}

          <button
            type="button"
            className="rbac-primary-btn"
            onClick={() => setIsAddModalOpen(true)}
          >
            <SvgIcon name="userPlus" size={15} />
            <span>Add User Credential</span>
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <div className="rbac-feedback-toast" role="status">
          <SvgIcon name="check" size={15} />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="rbac-nav-tabs-bar">
        <div className="rbac-tabs-left">
          <button
            type="button"
            className={`rbac-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <SvgIcon name="users" size={15} />
            <span>User Credentials</span>
            <span className="rbac-count-badge">{users.length}</span>
          </button>

          <button
            type="button"
            className={`rbac-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <SvgIcon name="key" size={15} />
            <span>Role Permissions Matrix</span>
          </button>

          <button
            type="button"
            className={`rbac-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <SvgIcon name="activity" size={15} />
            <span>Security &amp; Audit Trail</span>
            <span className="rbac-count-badge">{auditLogs.length}</span>
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="rbac-tab-filters">
            <div className="rbac-search-box">
              <SvgIcon name="search" size={14} />
              <input
                type="text"
                placeholder="Search by name, ID or branch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="rbac-clear-search-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <SvgIcon name="x" size={12} />
                </button>
              )}
            </div>

            <select
              className="rbac-role-filter-select"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="all">All Roles ({users.length})</option>
              <option value="admin">Administrators</option>
              <option value="accountant">Head Accountants</option>
              <option value="supervisor">Branch Supervisors</option>
              <option value="staff">Terminal Staff</option>
            </select>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: USER CREDENTIALS LIST                                         */}
      {/* ===================================================================== */}
      {activeTab === 'users' && (
        <div className="rbac-content-container">
          <div className="rbac-users-grid">
            {filteredUsers.map((user) => {
              const roleDef = roles[user.role] || DEFAULT_ROLES[user.role] || DEFAULT_ROLES.staff
              const isCurrentActive = currentUser?.username === user.username

              return (
                <div
                  key={user.id}
                  className={`rbac-user-card ${isCurrentActive ? 'is-active-session' : ''} ${
                    user.status === 'suspended' ? 'is-suspended' : ''
                  }`}
                >
                  <div className="rbac-user-card-header">
                    <div
                      className="rbac-user-avatar"
                      style={{
                        background: roleDef.bgColor,
                        color: roleDef.color,
                        borderColor: roleDef.borderColor,
                      }}
                    >
                      {user.avatar || user.name.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="rbac-user-header-meta">
                      <div className="rbac-user-name-row">
                        <strong className="rbac-user-fullname">{user.name}</strong>
                        {isCurrentActive && (
                          <span className="rbac-active-session-chip">Active Session</span>
                        )}
                      </div>
                      <span className="rbac-user-username">@{user.username}</span>
                    </div>

                    <div className="rbac-user-status-dot-wrap" title={`Status: ${user.status}`}>
                      <span className={`rbac-status-dot ${user.status}`} />
                    </div>
                  </div>

                  <div className="rbac-user-role-badge-row">
                    <span
                      className="rbac-role-pill"
                      style={{
                        color: roleDef.color,
                        background: roleDef.bgColor,
                        borderColor: roleDef.borderColor,
                      }}
                    >
                      <SvgIcon name="shieldCheck" size={12} />
                      {roleDef.label}
                    </span>
                    <span className="rbac-branch-pill">📍 {user.branch}</span>
                  </div>

                  <div className="rbac-user-card-body">
                    <div className="rbac-credential-detail-row">
                      <span className="rbac-detail-label">Access ID:</span>
                      <code className="rbac-detail-value">{user.username}</code>
                    </div>

                    <div className="rbac-credential-detail-row">
                      <span className="rbac-detail-label">Password:</span>
                      <span className="rbac-password-mask">••••••••••••</span>
                    </div>

                    <div className="rbac-credential-detail-row">
                      <span className="rbac-detail-label">Last Active:</span>
                      <span className="rbac-detail-subtext">{user.lastLogin || 'Never'}</span>
                    </div>
                  </div>

                  <div className="rbac-user-card-footer">
                    <button
                      type="button"
                      className="rbac-simulate-user-btn"
                      onClick={() => {
                        if (typeof onSimulateUser === 'function') {
                          onSimulateUser({
                            username: user.username,
                            name: user.name,
                            role: user.role,
                            roleLabel: roleDef.label,
                            roleBadge: roleDef.badge,
                            branch: user.branch,
                            avatar: user.avatar,
                            token: 'rbac-token-' + user.id,
                            loginTime: new Date().toISOString(),
                          })
                          showNotification(`Switched active session to @${user.username} (${roleDef.label})`)
                        }
                      }}
                      title="Instantly test dashboard and permissions as this user"
                    >
                      <SvgIcon name="logIn" size={13} />
                      <span>{isCurrentActive ? 'Current Session' : 'Login as User'}</span>
                    </button>

                    <div className="rbac-card-manage-btns">
                      <button
                        type="button"
                        className="rbac-icon-btn edit-btn"
                        onClick={() => setEditingUser({ ...user })}
                        title="Edit credentials and role"
                      >
                        <SvgIcon name="edit" size={14} />
                      </button>

                      {user.username !== 'admin' && (
                        <button
                          type="button"
                          className="rbac-icon-btn delete-btn"
                          onClick={() => setDeletingUser(user)}
                          title="Delete user credential"
                        >
                          <SvgIcon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="rbac-empty-state">
              <SvgIcon name="users" size={32} />
              <p>No user credentials match your search criteria.</p>
              <button
                type="button"
                className="rbac-clear-search-pill"
                onClick={() => {
                  setSearchQuery('')
                  setFilterRole('all')
                }}
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ROLE PERMISSIONS MATRIX                                       */}
      {/* ===================================================================== */}
      {activeTab === 'matrix' && (
        <div className="rbac-matrix-container">
          <div className="rbac-matrix-header-box">
            <div>
              <h3>Role Capabilities Matrix</h3>
              <p>
                Toggle operational privileges for each role tier. System Administrator holds immutable master rights.
              </p>
            </div>
            <button
              type="button"
              className="rbac-secondary-btn"
              onClick={handleResetRoles}
            >
              <SvgIcon name="refresh" size={14} />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="rbac-matrix-table-wrap">
            <table className="rbac-matrix-table">
              <thead>
                <tr>
                  <th className="perm-header-col">System Capability</th>
                  {Object.keys(roles).map((rKey) => {
                    const r = roles[rKey]
                    return (
                      <th key={rKey} className="role-col-header">
                        <div
                          className="role-header-chip"
                          style={{
                            color: r.color,
                            background: r.bgColor,
                            borderColor: r.borderColor,
                          }}
                        >
                          <SvgIcon name="shieldCheck" size={12} />
                          <span>{r.label}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm) => (
                  <tr key={perm.key}>
                    <td className="perm-cell-label">
                      <strong>{perm.label}</strong>
                      <span className="perm-group-tag">{perm.group}</span>
                    </td>
                    {Object.keys(roles).map((rKey) => {
                      const r = roles[rKey]
                      const isGranted = rKey === 'admin' ? true : (r.permissions || []).includes(perm.key)
                      const isLocked = rKey === 'admin'

                      return (
                        <td key={`${rKey}-${perm.key}`} className="matrix-check-cell">
                          <label
                            className={`rbac-perm-toggle ${isGranted ? 'granted' : 'denied'} ${
                              isLocked ? 'locked' : ''
                            }`}
                            title={
                              isLocked
                                ? 'System Administrator permissions are permanently enforced'
                                : `Click to toggle "${perm.label}" for ${r.label}`
                            }
                          >
                            <input
                              type="checkbox"
                              checked={isGranted}
                              disabled={isLocked}
                              onChange={() => handleTogglePermission(rKey, perm.key)}
                            />
                            <span className="rbac-perm-indicator">
                              {isGranted ? (
                                <>
                                  <SvgIcon name="check" size={12} />
                                  <span>Enabled</span>
                                </>
                              ) : (
                                <span className="denied-text">Disabled</span>
                              )}
                            </span>
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: AUDIT & SECURITY LOGS                                         */}
      {/* ===================================================================== */}
      {activeTab === 'logs' && (
        <div className="rbac-audit-container">
          <div className="rbac-audit-header-box">
            <div>
              <h3>Security &amp; Operational Audit Trail</h3>
              <p>Cryptographically recorded credential events, authentication gateways, and role reassignments.</p>
            </div>
            <span className="rbac-audit-ssl-seal">
              <SvgIcon name="lock" size={13} /> 256-Bit SSL Enforced
            </span>
          </div>

          <div className="rbac-logs-list">
            {auditLogs.map((log) => (
              <div key={log.id} className={`rbac-log-card severity-${log.severity || 'info'}`}>
                <div className="rbac-log-timestamp">
                  <span className="log-time">{log.timestamp}</span>
                  <span className="log-actor">@{log.actor}</span>
                </div>
                <div className="rbac-log-body">
                  <span className="rbac-log-action-tag">{log.action}</span>
                  <p className="rbac-log-details">{log.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD NEW USER CREDENTIAL                                       */}
      {/* ===================================================================== */}
      {isAddModalOpen && (
        <div
          className="rbac-modal-backdrop"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="rbac-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rbac-modal-header">
              <div className="rbac-modal-icon-badge">
                <SvgIcon name="userPlus" size={18} />
              </div>
              <div>
                <h3>Add User Credential</h3>
                <p>Register new staff access ID with role-based permissions.</p>
              </div>
              <button
                type="button"
                className="rbac-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                <SvgIcon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="rbac-modal-form">
              <div className="rbac-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Maria Clara Santos"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="rbac-form-group">
                <label>Username / Access ID</label>
                <input
                  type="text"
                  placeholder="e.g. maria.accountant"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
                <small className="rbac-field-hint">Used for sign in. Lowercase letters, numbers, dots.</small>
              </div>

              <div className="rbac-form-group">
                <div className="rbac-field-label-row">
                  <label>Initial Password</label>
                  <button
                    type="button"
                    className="rbac-password-gen-btn"
                    onClick={handleGeneratePassword}
                  >
                    Generate Secure
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Enter or generate password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="rbac-form-row-2col">
                <div className="rbac-form-group">
                  <label>Assign Role (RBAC)</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="accountant">Head Accountant</option>
                    <option value="supervisor">Branch Supervisor</option>
                    <option value="staff">Terminal Staff</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>

                <div className="rbac-form-group">
                  <label>Branch / Station</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    placeholder="e.g. Mandaue Branch"
                  />
                </div>
              </div>

              <div className="rbac-form-row-2col">
                <div className="rbac-form-group">
                  <label>Account Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="suspended">Suspended (Blocked)</option>
                  </select>
                </div>

                <div className="rbac-form-group">
                  <label>Email Notification (Optional)</label>
                  <input
                    type="email"
                    placeholder="user@luckybetplay.ph"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="rbac-modal-footer">
                <button
                  type="button"
                  className="rbac-secondary-btn"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="rbac-primary-btn">
                  Save Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: EDIT USER CREDENTIAL                                          */}
      {/* ===================================================================== */}
      {editingUser && (
        <div
          className="rbac-modal-backdrop"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="rbac-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rbac-modal-header">
              <div className="rbac-modal-icon-badge">
                <SvgIcon name="edit" size={18} />
              </div>
              <div>
                <h3>Edit User Credential</h3>
                <p>Modify settings for @{editingUser.username}</p>
              </div>
              <button
                type="button"
                className="rbac-modal-close-btn"
                onClick={() => setEditingUser(null)}
              >
                <SvgIcon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="rbac-modal-form">
              <div className="rbac-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  required
                />
              </div>

              <div className="rbac-form-group">
                <label>Password (Leave as is to keep existing)</label>
                <input
                  type="text"
                  value={editingUser.password}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  required
                />
              </div>

              <div className="rbac-form-row-2col">
                <div className="rbac-form-group">
                  <label>Role</label>
                  <select
                    value={editingUser.role}
                    disabled={editingUser.username === 'admin'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  >
                    <option value="accountant">Head Accountant</option>
                    <option value="supervisor">Branch Supervisor</option>
                    <option value="staff">Terminal Staff</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>

                <div className="rbac-form-group">
                  <label>Branch / Station</label>
                  <input
                    type="text"
                    value={editingUser.branch}
                    onChange={(e) => setEditingUser({ ...editingUser, branch: e.target.value })}
                  />
                </div>
              </div>

              <div className="rbac-form-group">
                <label>Status</label>
                <select
                  value={editingUser.status}
                  disabled={editingUser.username === 'admin'}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="rbac-modal-footer">
                <button
                  type="button"
                  className="rbac-secondary-btn"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="rbac-primary-btn">
                  Update Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: DELETE CONFIRMATION                                           */}
      {/* ===================================================================== */}
      {deletingUser && (
        <div
          className="rbac-modal-backdrop"
          onClick={() => setDeletingUser(null)}
        >
          <div
            className="rbac-modal-window modal-confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rbac-modal-header">
              <div className="rbac-modal-icon-badge danger">
                <SvgIcon name="trash" size={18} />
              </div>
              <div>
                <h3>Delete Credential?</h3>
                <p>Are you sure you want to remove <strong>@{deletingUser.username}</strong>?</p>
              </div>
            </div>

            <div className="rbac-confirm-body">
              <p>
                Revoking access for <strong>{deletingUser.name}</strong> ({deletingUser.roleLabel}) will immediately disconnect their workstation. This action is recorded in the security audit trail.
              </p>
            </div>

            <div className="rbac-modal-footer">
              <button
                type="button"
                className="rbac-secondary-btn"
                onClick={() => setDeletingUser(null)}
                disabled={isDeleting}
              >
                Keep Account
              </button>
              <button
                type="button"
                className="rbac-danger-btn"
                onClick={handleDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Revoke & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SUPABASE SQL SETUP HELPER                                     */}
      {/* ===================================================================== */}
      {showSqlModal && (
        <div className="rbac-modal-backdrop" onClick={() => setShowSqlModal(false)}>
          <div className="rbac-modal-window modal-sql-setup" onClick={(e) => e.stopPropagation()}>
            <div className="rbac-modal-header">
              <div className="rbac-modal-icon-badge info">
                <SvgIcon name="shieldCheck" size={18} />
              </div>
              <div>
                <h3>Supabase 'rbac_users' Table Setup</h3>
                <p>Run this script in your Supabase SQL Editor to activate dedicated cloud logins</p>
              </div>
            </div>

            <div className="rbac-sql-modal-body">
              <div className="sql-instruction-step">
                <strong>How to setup in 1 minute:</strong>
                <ol>
                  <li>Open your Supabase Project: <a href="https://supabase.com/dashboard/project/zebtqevwnockipsqifyf/sql" target="_blank" rel="noreferrer">SQL Editor</a>.</li>
                  <li>Click <strong>New Query</strong>, paste the script below, and click <strong>Run</strong>.</li>
                  <li>Once created, this workstation will automatically authenticate accounts directly from your Supabase table!</li>
                </ol>
              </div>
              <div className="sql-code-box">
                <pre>{SQL_SCRIPT_TEXT}</pre>
              </div>
            </div>

            <div className="rbac-modal-footer">
              <button
                type="button"
                className="rbac-secondary-btn"
                onClick={() => setShowSqlModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="rbac-primary-btn"
                onClick={() => {
                  navigator.clipboard.writeText(SQL_SCRIPT_TEXT)
                  showNotification('SQL Script copied to clipboard!')
                }}
              >
                <SvgIcon name="check" size={14} />
                Copy SQL Script
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
