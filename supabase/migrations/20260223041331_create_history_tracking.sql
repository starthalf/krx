/*
  # Create History Tracking System

  1. New Tables
    - `action_history`
      - Comprehensive history tracking for user actions and system events
      - Stores action type, entity information, changes, and metadata
      - Supports versioning and audit trail

  2. Security
    - Enable RLS on `action_history` table
    - Add policies for authenticated users to:
      - Read their own company's history
      - Create history entries for their own actions
    - System administrators can view all history

  3. Features
    - Track CRUD operations on key entities
    - Store before/after states for changes
    - Support for user actions, system events, and AI operations
    - Flexible JSON storage for entity-specific data
    - Full audit trail with timestamps and actor information
*/

CREATE TABLE IF NOT EXISTS action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name text,
  actor_type text DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'ai')),
  
  action_type text NOT NULL CHECK (action_type IN (
    'create', 'update', 'delete', 'approve', 'reject', 'submit', 
    'finalize', 'close', 'reopen', 'archive', 'restore',
    'invite', 'login', 'logout', 'permission_grant', 'permission_revoke',
    'planning_start', 'planning_complete', 'period_close', 'period_reopen',
    'okr_draft', 'okr_review', 'cascade', 'checkin', 'comment',
    'ai_generate', 'ai_regenerate', 'export', 'import', 'other'
  )),
  
  entity_type text NOT NULL CHECK (entity_type IN (
    'objective', 'key_result', 'organization', 'company', 'profile',
    'okr_set', 'fiscal_period', 'planning_cycle', 'invitation',
    'role', 'permission', 'checkin', 'comment', 'notification',
    'milestone', 'approval', 'review_request', 'kpi', 'other'
  )),
  
  entity_id uuid,
  entity_name text,
  
  parent_entity_type text,
  parent_entity_id uuid,
  
  description text NOT NULL,
  
  old_value jsonb DEFAULT '{}'::jsonb,
  new_value jsonb DEFAULT '{}'::jsonb,
  
  changes jsonb DEFAULT '{}'::jsonb,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  
  session_id text,
  ip_address inet,
  user_agent text,
  
  is_system_action boolean DEFAULT false,
  is_ai_action boolean DEFAULT false,
  
  severity text DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  
  tags text[] DEFAULT '{}'::text[],
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_history_company_id ON action_history(company_id);
CREATE INDEX IF NOT EXISTS idx_action_history_actor_id ON action_history(actor_id);
CREATE INDEX IF NOT EXISTS idx_action_history_entity ON action_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_action_history_action_type ON action_history(action_type);
CREATE INDEX IF NOT EXISTS idx_action_history_created_at ON action_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_history_parent_entity ON action_history(parent_entity_type, parent_entity_id);
CREATE INDEX IF NOT EXISTS idx_action_history_tags ON action_history USING gin(tags);

ALTER TABLE action_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's history"
  ON action_history
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create history entries for their actions"
  ON action_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (actor_id = auth.uid() OR actor_id IS NULL)
  );

CREATE POLICY "System can create history entries"
  ON action_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system_action = true
  );

COMMENT ON TABLE action_history IS 'Comprehensive audit trail and history tracking for all system actions';
COMMENT ON COLUMN action_history.actor_type IS 'Type of actor: user (human), system (automated), or ai (AI-generated)';
COMMENT ON COLUMN action_history.changes IS 'Detailed field-by-field changes in key-value format';
COMMENT ON COLUMN action_history.metadata IS 'Flexible JSON field for additional context-specific data';
COMMENT ON COLUMN action_history.severity IS 'Log severity level for filtering and alerting';
