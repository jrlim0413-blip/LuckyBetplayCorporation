-- =========================================================================
-- LUCKY BETPLAY CORPORATION: Dedicated RBAC Users Table in Supabase
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/zebtqevwnockipsqifyf
-- 2. Go to "SQL Editor" in the left sidebar.
-- 3. Click "New Query", paste this entire script, and click "RUN".
-- =========================================================================

-- 1. Create the dedicated rbac_users table
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

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.rbac_users ENABLE ROW LEVEL SECURITY;

-- 3. Allow public read, insert, update, and delete via the anon key
DROP POLICY IF EXISTS "Allow anon full access to rbac_users" ON public.rbac_users;
CREATE POLICY "Allow anon full access to rbac_users"
ON public.rbac_users
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Insert Initial Default Users
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
  status = EXCLUDED.status;
