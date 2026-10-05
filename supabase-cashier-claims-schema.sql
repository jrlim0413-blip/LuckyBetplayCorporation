-- =========================================================================
-- LUCKY BETPLAY CORPORATION: Cashier Negative Claims Table in Supabase
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/zebtqevwnockipsqifyf
-- 2. Go to "SQL Editor" in the left sidebar.
-- 3. Click "New Query", paste this entire script, and click "RUN".
-- =========================================================================

-- 1. Create the dedicated cashier_negative_claims table
CREATE TABLE IF NOT EXISTS public.cashier_negative_claims (
  id TEXT PRIMARY KEY,
  branch TEXT NOT NULL,
  claim_date DATE NOT NULL,
  supervisor TEXT NOT NULL,
  draw_rotation TEXT NOT NULL DEFAULT '1st Draw',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.cashier_negative_claims ENABLE ROW LEVEL SECURITY;

-- 3. Allow anon full access (read, insert, update, delete)
DROP POLICY IF EXISTS "Allow anon full access to cashier_negative_claims" ON public.cashier_negative_claims;
CREATE POLICY "Allow anon full access to cashier_negative_claims"
ON public.cashier_negative_claims
FOR ALL
USING (true)
WITH CHECK (true);
