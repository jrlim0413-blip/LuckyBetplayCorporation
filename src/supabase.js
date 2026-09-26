// src/supabase.js - Dedicated Supabase Client & Database Table Layer
import { createClient } from '@supabase/supabase-js'

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}

const supabaseUrl =
  env.VITE_SUPABASE_URL || 'https://zebtqevwnockipsqifyf.supabase.co'
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYnRxZXZ3bm9ja2lwc3FpZnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzODQ1MjcsImV4cCI6MjEwNTk2MDUyN30.RtcBRjoaq4r1hVb6UD7OGKYblASi_-DmQa6DDTs7lDU'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const RBAC_TABLE_NAME = 'rbac_users'

/**
 * Normalize an identifier to an email address format suitable for Supabase Auth.
 */
export function formatSupabaseEmail(identifier) {
  const clean = String(identifier || '').trim().toLowerCase()
  if (clean.includes('@')) return clean
  return `${clean}@luckybetplay.ph`
}

// =============================================================================
// DEDICATED TABLE AUTHENTICATION & RBAC DIRECTORY
// =============================================================================

/**
 * Verify username and password strictly against the Supabase 'rbac_users' table.
 * If user is not found in the table, or password doesn't match, or is suspended,
 * access is explicitly denied.
 */
export async function verifyCredentialsInSupabaseTable(username, password) {
  if (!supabase) {
    return { success: false, error: 'Supabase client is not configured' }
  }

  const cleanUser = String(username || '').trim().toLowerCase()
  const cleanPass = String(password || '').trim()

  try {
    const { data, error } = await supabase
      .from(RBAC_TABLE_NAME)
      .select('*')
      .ilike('username', cleanUser)
      .limit(1)

    // Table has not been created yet in PostgreSQL
    if (error) {
      const isMissingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        (error.message && error.message.includes('not find the table'))
      return {
        success: false,
        tableMissing: isMissingTable,
        error: error.message,
      }
    }

    // Account not found in directory
    if (!data || data.length === 0) {
      return {
        success: false,
        notFound: true,
        error: `Account "${username}" is not registered in the authorized credentials directory.`,
      }
    }

    const account = data[0]

    // Account status check
    if (account.status === 'suspended' || account.status === 'inactive') {
      return {
        success: false,
        inactive: true,
        error: `Access denied. The account "${account.username}" is currently ${account.status}.`,
      }
    }

    // Strict Password Verification
    if (account.password !== cleanPass) {
      return {
        success: false,
        wrongPassword: true,
        error: 'Invalid password. Please verify your credentials and try again.',
      }
    }

    // Update last_login timestamp asynchronously
    supabase
      .from(RBAC_TABLE_NAME)
      .update({ last_login: new Date().toISOString() })
      .eq('id', account.id)
      .then(() => {})
      .catch(() => {})

    return {
      success: true,
      account: {
        id: account.id,
        username: account.username,
        name: account.name,
        role: account.role,
        roleLabel: account.role_label || account.roleLabel,
        branch: account.branch,
        status: account.status,
        avatar: account.avatar || account.name.substring(0, 2).toUpperCase(),
        email: account.email,
        createdAt: account.created_at,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Error connecting to dedicated database table.',
    }
  }
}

/**
 * Fetch all authorized accounts from Supabase 'rbac_users' table.
 */
export async function getSupabaseRbacUsers() {
  if (!supabase) return { success: false, data: [] }
  try {
    const { data, error } = await supabase
      .from(RBAC_TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return {
        success: false,
        tableMissing: error.code === 'PGRST205',
        error: error.message,
        data: [],
      }
    }

    const normalized = (data || []).map((row) => ({
      id: row.id,
      username: row.username,
      password: row.password,
      name: row.name,
      role: row.role,
      roleLabel: row.role_label,
      branch: row.branch,
      status: row.status,
      avatar: row.avatar,
      email: row.email,
      lastLogin: row.last_login ? new Date(row.last_login).toLocaleString() : 'Never',
      createdAt: row.created_at ? row.created_at.split('T')[0] : '',
    }))

    return { success: true, data: normalized }
  } catch (err) {
    return { success: false, error: err.message, data: [] }
  }
}

/**
 * Insert or update an account in Supabase 'rbac_users' table.
 */
export async function saveRbacUserToSupabase(user) {
  if (!supabase) return { success: false, error: 'Supabase is not configured' }
  try {
    const payload = {
      id: user.id || `usr_${Date.now()}`,
      username: String(user.username || '').trim().toLowerCase(),
      password: String(user.password || '').trim(),
      name: user.name,
      role: user.role,
      role_label: user.roleLabel || user.role_label,
      branch: user.branch,
      status: user.status || 'active',
      avatar: user.avatar || user.name.substring(0, 2).toUpperCase(),
      email: user.email || `${user.username}@luckybetplay.ph`,
    }

    const { data, error } = await supabase
      .from(RBAC_TABLE_NAME)
      .upsert(payload, { onConflict: 'username' })
      .select()

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Delete an account from Supabase 'rbac_users' table.
 */
export async function deleteRbacUserFromSupabase(id, username) {
  if (!supabase) return { success: false, error: 'Supabase is not configured' }
  try {
    const cleanUser = username ? String(username).trim().toLowerCase() : ''
    const cleanId = id ? String(id).trim() : ''

    let query = supabase.from(RBAC_TABLE_NAME).delete()
    if (cleanId && cleanUser) {
      query = query.or(`id.eq.${cleanId},username.eq.${cleanUser}`)
    } else if (cleanId) {
      query = query.eq('id', cleanId)
    } else if (cleanUser) {
      query = query.eq('username', cleanUser)
    } else {
      return { success: false, error: 'No identifier provided for deletion' }
    }

    const { error } = await query

    if (error) {
      console.error('Supabase delete error:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    console.error('Supabase delete exception:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Seed initial default users into the table if empty.
 */
export async function seedDefaultUsersToSupabase(defaultUsers) {
  if (!supabase || !Array.isArray(defaultUsers) || defaultUsers.length === 0) return
  try {
    const rows = defaultUsers.map((u) => ({
      id: u.id,
      username: u.username.toLowerCase(),
      password: u.password,
      name: u.name,
      role: u.role,
      role_label: u.roleLabel,
      branch: u.branch,
      status: u.status || 'active',
      avatar: u.avatar,
      email: u.email,
    }))

    await supabase.from(RBAC_TABLE_NAME).upsert(rows, { onConflict: 'username' })
  } catch {}
}

// =============================================================================
// SUPABASE AUTH (OAuth / Email fallback)
// =============================================================================

export async function signInWithSupabase(identifier, password) {
  if (!supabase) return { success: false, error: 'Supabase client is not configured' }
  const email = formatSupabaseEmail(identifier)

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) return { success: false, error: error.message }
    return { success: true, user: data.user, session: data.session }
  } catch (err) {
    return { success: false, error: err.message || 'Supabase authentication failed' }
  }
}

export async function signUpWithSupabase(email, password, metadata = {}) {
  if (!supabase) return { success: false, error: 'Supabase client is not configured' }
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })

    if (error) return { success: false, error: error.message }
    return { success: true, user: data.user, session: data.session }
  } catch (err) {
    return { success: false, error: err.message || 'Supabase registration failed' }
  }
}

export async function signOutFromSupabase() {
  if (!supabase) return { error: null }
  try {
    return await supabase.auth.signOut()
  } catch (err) {
    return { error: err }
  }
}

export async function getSupabaseSession() {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session || null
  } catch {
    return null
  }
}
