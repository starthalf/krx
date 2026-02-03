// src/lib/database.types.ts
// Supabase CLI로 자동 생성 가능: npx supabase gen types typescript
// 여기서는 수동으로 정의

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          industry: string
          size: number
          fiscal_year: string
          vision: string | null
          strategy: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          industry: string
          size?: number
          fiscal_year?: string
          vision?: string | null
          strategy?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          industry?: string
          size?: number
          fiscal_year?: string
          vision?: string | null
          strategy?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          company_id: string | null
          full_name: string
          role: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          company_id?: string | null
          full_name?: string
          role?: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          full_name?: string
          role?: string
          avatar_url?: string | null
          created_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          company_id: string
          name: string
          level: '전사' | '부문' | '본부' | '실' | '팀'
          parent_org_id: string | null
          org_type: 'Front' | 'Middle' | 'Back'
          mission: string
          function_tags: string[]
          headcount: number
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          level: '전사' | '부문' | '본부' | '실' | '팀'
          parent_org_id?: string | null
          org_type: 'Front' | 'Middle' | 'Back'
          mission?: string
          function_tags?: string[]
          headcount?: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          level?: '전사' | '부문' | '본부' | '실' | '팀'
          parent_org_id?: string | null
          org_type?: 'Front' | 'Middle' | 'Back'
          mission?: string
          function_tags?: string[]
          headcount?: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      objectives: {
        Row: {
          id: string
          org_id: string
          name: string
          bii_type: 'Build' | 'Innovate' | 'Improve'
          period: string
          status: 'draft' | 'review' | 'agreed' | 'active' | 'reviewing' | 'completed'
          parent_obj_id: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          bii_type: 'Build' | 'Innovate' | 'Improve'
          period?: string
          status?: 'draft' | 'review' | 'agreed' | 'active' | 'reviewing' | 'completed'
          parent_obj_id?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          bii_type?: 'Build' | 'Innovate' | 'Improve'
          period?: string
          status?: 'draft' | 'review' | 'agreed' | 'active' | 'reviewing' | 'completed'
          parent_obj_id?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      key_results: {
        Row: {
          id: string
          objective_id: string
          org_id: string
          name: string
          definition: string
          formula: string
          unit: string
          weight: number
          target_value: number
          current_value: number
          bii_type: 'Build' | 'Innovate' | 'Improve'
          bii_score: number
          kpi_category: '전략' | '고유업무' | '공통'
          perspective: '재무' | '고객' | '프로세스' | '학습성장'
          indicator_type: '투입' | '과정' | '산출' | '결과'
          measurement_cycle: '월' | '분기' | '반기' | '연'
          grade_criteria: {
            S: number
            A: number
            B: number
            C: number
            D: number
          }
          quarterly_targets: {
            Q1: number
            Q2: number
            Q3: number
            Q4: number
          }
          quarterly_actuals: {
            Q1: number | null
            Q2: number | null
            Q3: number | null
            Q4: number | null
          }
          cascading_type: 'Full' | 'Shared' | 'Joint' | null
          parent_kr_id: string | null
          pool_kpi_id: string | null
          status: 'draft' | 'agreed' | 'active' | 'completed'
          data_source: 'auto' | 'manual' | 'hybrid'
          data_source_detail: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          objective_id: string
          org_id: string
          name: string
          definition?: string
          formula?: string
          unit?: string
          weight?: number
          target_value?: number
          current_value?: number
          bii_type: 'Build' | 'Innovate' | 'Improve'
          bii_score?: number
          kpi_category?: '전략' | '고유업무' | '공통'
          perspective?: '재무' | '고객' | '프로세스' | '학습성장'
          indicator_type?: '투입' | '과정' | '산출' | '결과'
          measurement_cycle?: '월' | '분기' | '반기' | '연'
          grade_criteria?: object
          quarterly_targets?: object
          quarterly_actuals?: object
          cascading_type?: 'Full' | 'Shared' | 'Joint' | null
          parent_kr_id?: string | null
          pool_kpi_id?: string | null
          status?: 'draft' | 'agreed' | 'active' | 'completed'
          data_source?: 'auto' | 'manual' | 'hybrid'
          data_source_detail?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['key_results']['Insert']>
      }
      milestones: {
        Row: {
          id: string
          kr_id: string
          text: string
          quarter: string
          completed: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          kr_id: string
          text: string
          quarter: string
          completed?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          kr_id?: string
          text?: string
          quarter?: string
          completed?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      cfr_threads: {
        Row: {
          id: string
          kr_id: string
          type: 'Conversation' | 'Feedback' | 'Recognition'
          content: string
          author_id: string | null
          author_name: string
          created_at: string
        }
        Insert: {
          id?: string
          kr_id: string
          type: 'Conversation' | 'Feedback' | 'Recognition'
          content: string
          author_id?: string | null
          author_name: string
          created_at?: string
        }
        Update: {
          id?: string
          kr_id?: string
          type?: 'Conversation' | 'Feedback' | 'Recognition'
          content?: string
          author_id?: string | null
          author_name?: string
          created_at?: string
        }
      }
      checkins: {
        Row: {
          id: string
          kr_id: string
          period: string
          value: number
          comment: string | null
          checked_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          kr_id: string
          period: string
          value: number
          comment?: string | null
          checked_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          kr_id?: string
          period?: string
          value?: number
          comment?: string | null
          checked_by?: string | null
          created_at?: string
        }
      }
      kpi_pool: {
        Row: {
          id: string
          name: string
          definition: string
          formula: string
          function_tags: string[]
          industry_tags: string[]
          org_level_tags: string[]
          perspective: string
          indicator_type: string
          unit: string
          usage_count: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          definition: string
          formula: string
          function_tags?: string[]
          industry_tags?: string[]
          org_level_tags?: string[]
          perspective: string
          indicator_type: string
          unit?: string
          usage_count?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['kpi_pool']['Insert']>
      }
    }
    Views: {
      key_results_with_progress: {
        Row: {
          id: string
          objective_id: string
          org_id: string
          name: string
          target_value: number
          current_value: number
          progress_pct: number
          current_grade: string
          objective_name: string
          org_name: string
          // ... 기타 key_results 컬럼들
        }
      }
      org_okr_summary: {
        Row: {
          org_id: string
          org_name: string
          org_level: string
          objective_count: number
          kr_count: number
          avg_progress: number
          grade_s_count: number
          grade_a_count: number
          grade_b_count: number
          grade_c_count: number
          grade_d_count: number
        }
      }
    }
    Functions: {
      calculate_progress_pct: {
        Args: { target: number; current: number }
        Returns: number
      }
      calculate_grade: {
        Args: { progress: number; criteria: Json }
        Returns: string
      }
    }
  }
}

// 편의를 위한 타입 alias
export type Company = Database['public']['Tables']['companies']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Organization = Database['public']['Tables']['organizations']['Row']
export type Objective = Database['public']['Tables']['objectives']['Row']
export type KeyResult = Database['public']['Tables']['key_results']['Row']
export type Milestone = Database['public']['Tables']['milestones']['Row']
export type CFRThread = Database['public']['Tables']['cfr_threads']['Row']
export type Checkin = Database['public']['Tables']['checkins']['Row']
export type KPIPool = Database['public']['Tables']['kpi_pool']['Row']

// Insert 타입
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
export type ObjectiveInsert = Database['public']['Tables']['objectives']['Insert']
export type KeyResultInsert = Database['public']['Tables']['key_results']['Insert']
export type MilestoneInsert = Database['public']['Tables']['milestones']['Insert']
export type CFRThreadInsert = Database['public']['Tables']['cfr_threads']['Insert']
export type CheckinInsert = Database['public']['Tables']['checkins']['Insert']

// View 타입
export type KeyResultWithProgress = Database['public']['Views']['key_results_with_progress']['Row']
export type OrgOKRSummary = Database['public']['Views']['org_okr_summary']['Row']