// src/supabase.js - Dedicated Supabase Client & Authentication Layer
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

/**
 * Normalize an identifier to an email address format suitable for Supabase Auth.
 * If user passes a standard corporate Access ID / username (e.g. 'mandaue.staff', 'admin'),
 * it maps to '<username>@luckybetplay.ph'.
 */
export function formatSupabaseEmail(identifier) {
  const clean = String(identifier || '').trim().toLowerCase()
  if (clean.includes('@')) return clean
  return `${clean}@luckybetplay.ph`
}

/**
 * Sign in using Supabase Auth.
 * @param {string} identifier - Email address or Access ID username
 * @param {string} password - Password
 * @returns {Promise<{ success: boolean, user?: object, session?: object, error?: string }>}
 */
export async function signInWithSupabase(identifier, password) {
  if (!supabase) {
    return { success: false, error: 'Supabase client is not configured' }
  }

  const email = formatSupabaseEmail(identifier)

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    }
  } catch (err) {
    return { success: false, error: err.message || 'Supabase authentication failed' }
  }
}

/**
 * Sign up a new user via Supabase Auth.
 * @param {string} email
 * @param {string} password
 * @param {object} metadata - Extra profile data (name, role, branch)
 */
export async function signUpWithSupabase(email, password, metadata = {}) {
  if (!supabase) {
    return { success: false, error: 'Supabase client is not configured' }
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    }
  } catch (err) {
    return { success: false, error: err.message || 'Supabase registration failed' }
  }
}

/**
 * Sign out from Supabase Auth session.
 */
export async function signOutFromSupabase() {
  if (!supabase) return { error: null }
  try {
    return await supabase.auth.signOut()
  } catch (err) {
    return { error: err }
  }
}

/**
 * Retrieve current active Supabase session.
 */
export async function getSupabaseSession() {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session || null
  } catch {
    return null
  }
}
