// src/store/useStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { 
  Company, 
  Organization, 
  Objective, 
  DynamicKR, 
  CFRThread 
} from '../types';

interface AppState {
  // ==================== State ====================
  company: Company | null;
  organizations: Organization[];
  objectives: Objective[];
  krs: DynamicKR[];
  cfrThreads: CFRThread[];
  dashboardStats: any[]; // [New] 대시보드 통계 데이터
  loading: boolean;
  error: string | null;

  // ==================== Company ====================
  setCompany: (company: Company) => void;

  // ==================== Organizations ====================
  fetchOrganizations: (companyId: string) => Promise<void>;
  addOrganization: (org: Omit<Organization, 'id' | 'children'>) => Promise<void>;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<void>;
  deleteOrganization: (orgId: string) => Promise<void>;
  
  // ==================== Objectives ====================
  fetchObjectives: (orgId: string) => Promise<void>;
  addObjective: (objective: Omit<Objective, 'id'>) => Promise<void>;
  updateObjective: (objId: string, updates: Partial<Objective>) => Promise<void>;
  deleteObjective: (objId: string) => Promise<void>;

  // ==================== Key Results ====================
  fetchKRs: (orgId: string) => Promise<void>;
  addKR: (kr: Omit<DynamicKR, 'id' | 'progressPct' | 'grade' | 'milestones'>) => Promise<void>;
  updateKR: (krId: string, updates: Partial<DynamicKR>) => Promise<void>;
  deleteKR: (krId: string) => Promise<void>;

  // ==================== CFR (Conversations, Feedback, Recognition) ====================
  fetchCFRs: (krId: string) => Promise<void>;
  addCFRThread: (cfr: Omit<CFRThread, 'id' | 'createdAt'>) => Promise<void>;
  getCFRsByKRId: (krId: string) => CFRThread[];

  // ==================== Dashboard ====================
  fetchDashboardStats: (companyId: string) => Promise<void>; // [New] 대시보드 통계 불러오기

  // ==================== Getters ====================
  getOrgById: (orgId: string) => Organization | undefined;
  getObjectivesByOrgId: (orgId: string) => Objective[];
  getKRsByObjectiveId: (objId: string) => DynamicKR[];
  getKRsByOrgId: (orgId: string) => DynamicKR[];
}

export const useStore = create<AppState>((set, get) => ({
  // ==================== Initial State ====================
  company: null,
  organizations: [],
  objectives: [],
  krs: [],
  cfrThreads: [],
  dashboardStats: [], // [New] 초기값
  loading: false,
  error: null,

  // ==================== Company ====================
  setCompany: (company) => set({ company }),

  // ==================== Organizations ====================
  fetchOrganizations: async (companyId) => {
    console.log('🔄 fetchOrganizations called with:', companyId);
    set({ loading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order');
      
      if (error) throw error;
      
      console.log('✅ Fetched organizations:', data?.length);
      
      if (data) {
        const organizations: Organization[] = data.map(org => ({
          id: org.id,
          companyId: org.company_id,
          name: org.name,
          level: org.level,
          parentOrgId: org.parent_org_id || null,
          orgType: org.org_type,
          mission: org.mission || '',
          functionTags: org.function_tags || [],
          headcount: org.headcount || 0,
          children: [] // 트리 구조는 UI에서 계산
        }));
        
        set({ organizations });
      }
    } catch (error: any) {
      console.error('❌ fetchOrganizations error:', error);
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  addOrganization: async (org) => {
    console.log('➕ addOrganization:', org.name);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          company_id: org.companyId,
          name: org.name,
          level: org.level,
          parent_org_id: org.parentOrgId,
          org_type: org.orgType,
          mission: org.mission,
          function_tags: org.functionTags,
          headcount: org.headcount,
          sort_order: 0
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newOrg: Organization = {
          id: data.id,
          companyId: data.company_id,
          name: data.name,
          level: data.level,
          parentOrgId: data.parent_org_id,
          orgType: data.org_type,
          mission: data.mission || '',
          functionTags: data.function_tags || [],
          headcount: data.headcount || 0,
          children: []
        };
        
        set(state => ({
          organizations: [...state.organizations, newOrg]
        }));
        
        console.log('✅ Organization added');
      }
    } catch (error: any) {
      console.error('❌ addOrganization error:', error);
      set({ error: error.message });
    }
  },

  updateOrganization: async (orgId, updates) => {
    console.log('✏️ updateOrganization:', orgId, updates);
    try {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.level !== undefined) dbUpdates.level = updates.level;
      if (updates.orgType !== undefined) dbUpdates.org_type = updates.orgType;
      if (updates.mission !== undefined) dbUpdates.mission = updates.mission;
      if (updates.functionTags !== undefined) dbUpdates.function_tags = updates.functionTags;
      if (updates.headcount !== undefined) dbUpdates.headcount = updates.headcount;
      if (updates.parentOrgId !== undefined) dbUpdates.parent_org_id = updates.parentOrgId;

      const { error } = await supabase
        .from('organizations')
        .update(dbUpdates)
        .eq('id', orgId);

      if (error) throw error;

      set(state => ({
        organizations: state.organizations.map(org =>
          org.id === orgId ? { ...org, ...updates } : org
        )
      }));

      console.log('✅ Organization updated');
    } catch (error: any) {
      console.error('❌ updateOrganization error:', error);
      set({ error: error.message });
    }
  },

  deleteOrganization: async (orgId) => {
    console.log('🗑️ deleteOrganization:', orgId);
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;

      set(state => ({
        organizations: state.organizations.filter(org => org.id !== orgId)
      }));

      console.log('✅ Organization deleted');
    } catch (error: any) {
      console.error('❌ deleteOrganization error:', error);
      set({ error: error.message });
    }
  },

  // ==================== Objectives ====================
  fetchObjectives: async (orgId) => {
    console.log('🔄 fetchObjectives for org:', orgId);
    try {
      const { data, error } = await supabase
        .from('objectives')
        .select('*')
        .eq('org_id', orgId)
        .order('sort_order');

      if (error) throw error;
      
      console.log('✅ Fetched objectives:', data?.length);

      if (data) {
        const newObjs: Objective[] = data.map(obj => ({
          id: obj.id,
          orgId: obj.org_id,
          name: obj.name,
          biiType: obj.bii_type,
          period: obj.period,
          status: obj.status,
          parentObjId: obj.parent_obj_id,
          order: obj.sort_order
        }));
        
        // 다른 org의 objectives는 유지하고, 이 org의 것만 교체
        const existing = get().objectives.filter(o => o.orgId !== orgId);
        set({ objectives: [...existing, ...newObjs] });
      }
    } catch (error: any) {
      console.error('❌ fetchObjectives error:', error);
      set({ error: error.message });
    }
  },

  addObjective: async (obj) => {
    console.log('➕ addObjective:', obj.name);
    try {
      const { data, error } = await supabase
        .from('objectives')
        .insert({
          org_id: obj.orgId,
          name: obj.name,
          bii_type: obj.biiType,
          period: obj.period || '2025-H1',
          status: obj.status || 'draft',
          parent_obj_id: obj.parentObjId,
          sort_order: obj.order || 0
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newObj: Objective = {
          id: data.id,
          orgId: data.org_id,
          name: data.name,
          biiType: data.bii_type,
          period: data.period,
          status: data.status,
          parentObjId: data.parent_obj_id,
          order: data.sort_order
        };
        
        set(state => ({
          objectives: [...state.objectives, newObj]
        }));
        
        console.log('✅ Objective added');
      }
    } catch (error: any) {
      console.error('❌ addObjective error:', error);
      set({ error: error.message });
    }
  },

  updateObjective: async (objId, updates) => {
    console.log('✏️ updateObjective:', objId, updates);
    try {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.biiType !== undefined) dbUpdates.bii_type = updates.biiType;

      const { error } = await supabase
        .from('objectives')
        .update(dbUpdates)
        .eq('id', objId);

      if (error) throw error;

      set(state => ({
        objectives: state.objectives.map(obj =>
          obj.id === objId ? { ...obj, ...updates } : obj
        )
      }));

      console.log('✅ Objective updated');
    } catch (error: any) {
      console.error('❌ updateObjective error:', error);
      set({ error: error.message });
    }
  },

  deleteObjective: async (objId) => {
    console.log('🗑️ deleteObjective:', objId);
    try {
      const { error } = await supabase
        .from('objectives')
        .delete()
        .eq('id', objId);

      if (error) throw error;

      set(state => ({
        objectives: state.objectives.filter(obj => obj.id !== objId)
      }));

      console.log('✅ Objective deleted');
    } catch (error: any) {
      console.error('❌ deleteObjective error:', error);
      set({ error: error.message });
    }
  },

  // ==================== Key Results ====================
  fetchKRs: async (orgId) => {
    console.log('🔄 fetchKRs for org:', orgId);
    try {
      const { data, error } = await supabase
        .from('key_results')
        .select(`
          *,
          milestones (*)
        `)
        .eq('org_id', orgId)
        .order('created_at');

      if (error) throw error;
      
      console.log('✅ Fetched KRs:', data?.length);

      if (data) {
        const krs: DynamicKR[] = data.map((kr: any) => ({
          id: kr.id,
          objectiveId: kr.objective_id,
          orgId: kr.org_id,
          name: kr.name,
          definition: kr.definition || '',
          formula: kr.formula || '',
          unit: kr.unit,
          weight: kr.weight,
          targetValue: kr.target_value,
          currentValue: kr.current_value,
          progressPct: kr.progress_pct || 0,
          grade: calculateGrade(kr.progress_pct || 0, kr.grade_criteria),
          biiType: kr.bii_type,
          biiScore: kr.bii_score || 0,
          kpiCategory: kr.kpi_category,
          perspective: kr.perspective,
          indicatorType: kr.indicator_type,
          measurementCycle: kr.measurement_cycle,
          gradeCriteria: kr.grade_criteria,
          quarterlyTargets: kr.quarterly_targets,
          quarterlyActuals: kr.quarterly_actuals,
          cascadingType: kr.cascading_type,
          parentKrId: kr.parent_kr_id,
          poolKpiId: kr.pool_kpi_id,
          status: kr.status,
          dataSource: kr.data_source,
          dataSourceDetail: kr.data_source_detail,
          milestones: kr.milestones ? kr.milestones.map((m: any) => ({
            id: m.id,
            text: m.text,
            quarter: m.quarter,
            completed: m.completed || false
          })) : []
        }));
        
        // 다른 org의 KRs는 유지하고, 이 org의 것만 교체
        const existing = get().krs.filter(k => k.orgId !== orgId);
        set({ krs: [...existing, ...krs] });
      }
    } catch (error: any) {
      console.error('❌ fetchKRs error:', error);
      set({ error: error.message });
    }
  },

  addKR: async (kr) => {
    console.log('➕ addKR:', kr.name);
    try {
      const { data, error } = await supabase
        .from('key_results')
        .insert({
          objective_id: kr.objectiveId,
          org_id: kr.orgId,
          name: kr.name,
          definition: kr.definition || '',
          formula: kr.formula || '',
          unit: kr.unit || '%',
          weight: kr.weight || 0,
          target_value: kr.targetValue || 0,
          current_value: kr.currentValue || 0,
          bii_type: kr.biiType,
          bii_score: kr.biiScore || 0,
          kpi_category: kr.kpiCategory || '전략',
          perspective: kr.perspective || '재무',
          indicator_type: kr.indicatorType || '결과',
          measurement_cycle: kr.measurementCycle || '월',
          grade_criteria: kr.gradeCriteria || { S: 120, A: 110, B: 100, C: 90, D: 0 },
          quarterly_targets: kr.quarterlyTargets || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
          quarterly_actuals: kr.quarterlyActuals || { Q1: null, Q2: null, Q3: null, Q4: null },
          cascading_type: kr.cascadingType,
          parent_kr_id: kr.parentKrId,
          pool_kpi_id: kr.poolKpiId,
          status: kr.status || 'active',
          data_source: kr.dataSource || 'manual',
          data_source_detail: kr.dataSourceDetail
        })
        .select()
        .single();

      if (error) throw error;

      // 다시 fetch해서 최신 데이터 가져오기
      await get().fetchKRs(kr.orgId);
      
      console.log('✅ KR added');
    } catch (error: any) {
      console.error('❌ addKR error:', error);
      set({ error: error.message });
    }
  },

  updateKR: async (krId, updates) => {
    console.log('✏️ updateKR:', krId, updates);
    try {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;
      if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
      if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue;

      const { error } = await supabase
        .from('key_results')
        .update(dbUpdates)
        .eq('id', krId);

      if (error) throw error;

      set(state => ({
        krs: state.krs.map(k =>
          k.id === krId ? { ...k, ...updates } : k
        )
      }));

      console.log('✅ KR updated');
    } catch (error: any) {
      console.error('❌ updateKR error:', error);
      set({ error: error.message });
    }
  },

  deleteKR: async (krId) => {
    console.log('🗑️ deleteKR:', krId);
    try {
      const { error } = await supabase
        .from('key_results')
        .delete()
        .eq('id', krId);

      if (error) throw error;

      set(state => ({
        krs: state.krs.filter(k => k.id !== krId)
      }));

      console.log('✅ KR deleted');
    } catch (error: any) {
      console.error('❌ deleteKR error:', error);
      set({ error: error.message });
    }
  },

  // ==================== CFR (Conversations, Feedback, Recognition) ====================
  fetchCFRs: async (krId) => {
    const { data } = await supabase
      .from('cfr_threads')
      .select('*')
      .eq('kr_id', krId)
      .order('created_at', { ascending: false });
    
    if (data) {
      // 기존 CFR에 새로운 CFR 추가 (누적 방식)
      set(state => {
        const existingIds = new Set(state.cfrThreads.map(c => c.id));
        const newCFRs = data
          .filter(c => !existingIds.has(c.id))
          .map(c => ({
            id: c.id,
            krId: c.kr_id,
            type: c.type,
            content: c.content,
            author: c.author_name,
            createdAt: c.created_at
          }));
        
        return {
          cfrThreads: [...state.cfrThreads, ...newCFRs]
        };
      });
    }
  },

  addCFRThread: async (cfr) => {
    try {
      // DB에 저장
      const { data, error } = await supabase
        .from('cfr_threads')
        .insert({
          kr_id: cfr.krId,
          type: cfr.type,
          content: cfr.content,
          author_name: cfr.author,
          author_id: null  // 현재는 null, 나중에 실제 유저 ID 연결
        })
        .select()
        .single();

      if (error) throw error;

      // Store 업데이트
      if (data) {
        set(state => ({
          cfrThreads: [...state.cfrThreads, {
            id: data.id,
            krId: data.kr_id,
            type: data.type,
            content: data.content,
            author: data.author_name,
            createdAt: data.created_at
          }]
        }));
      }
    } catch (error: any) {
      console.error('❌ addCFRThread error:', error);
      set({ error: error.message });
    }
  },

  getCFRsByKRId: (krId) => {
    // 최신순 정렬
    return get().cfrThreads
      .filter(c => c.krId === krId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // ==================== Dashboard ====================
  // [New] 대시보드 통계 가져오기 구현
  fetchDashboardStats: async (companyId) => {
    try {
      const { data, error } = await supabase.rpc('get_org_stats', { 
        target_company_id: companyId 
      });
      
      if (error) throw error;
      
      set({ dashboardStats: data || [] });
    } catch (error) {
      console.error('Dashboard stats fetch error:', error);
      set({ dashboardStats: [] });
    }
  },

  // ==================== Getters ====================
  getOrgById: (orgId) => {
    return get().organizations.find(o => o.id === orgId);
  },

  getObjectivesByOrgId: (orgId) => {
    return get().objectives.filter(o => o.orgId === orgId);
  },

  getKRsByObjectiveId: (objId) => {
    return get().krs.filter(k => k.objectiveId === objId);
  },

  getKRsByOrgId: (orgId) => {
    return get().krs.filter(k => k.orgId === orgId);
  },
}));

// ==================== Helper Functions ====================
function calculateGrade(progressPct: number, criteria: any): string {
  if (!criteria) return 'N/A';
  
  if (progressPct >= criteria.S) return 'S';
  if (progressPct >= criteria.A) return 'A';
  if (progressPct >= criteria.B) return 'B';
  if (progressPct >= criteria.C) return 'C';
  return 'D';
}