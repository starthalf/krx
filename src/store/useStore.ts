// src/store/useStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Company, Organization, Objective, DynamicKR, CFRThread, ActivityFeedItem, PoolKPI } from '../types';

interface AppState {
  // State
  organizations: Organization[];
  objectives: Objective[];
  krs: DynamicKR[];
  loading: boolean;
  company: Company | null;

  // Actions
  fetchOrganizations: (companyId: string) => Promise<void>;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<void>;
  
  fetchObjectives: (orgId: string) => Promise<void>;
  addObjective: (objective: Omit<Objective, 'id'>) => Promise<void>;
  updateObjective: (objId: string, updates: Partial<Objective>) => Promise<void>;
  deleteObjective: (objId: string) => Promise<void>;

  fetchKRs: (orgId: string) => Promise<void>; // 조직 단위 조회로 변경 (효율성 위함)
  addKR: (kr: Omit<DynamicKR, 'id'>) => Promise<void>;
  updateKR: (krId: string, updates: Partial<DynamicKR>) => Promise<void>;
  deleteKR: (krId: string) => Promise<void>;

  getOrgById: (orgId: string) => Organization | undefined;
  getObjectivesByOrgId: (orgId: string) => Objective[];
  getKRsByObjectiveId: (objId: string) => DynamicKR[];
}

export const useStore = create<AppState>((set, get) => ({
  organizations: [],
  objectives: [],
  krs: [],
  loading: false,
  company: null,

  // ----------------------------------------------------
  // 1. Organization
  // ----------------------------------------------------
  fetchOrganizations: async (companyId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order');
      
    if (data) {
      set({ organizations: data.map(org => ({
        id: org.id,
        companyId: org.company_id,
        name: org.name,
        level: org.level,
        parentOrgId: org.parent_org_id,
        orgType: org.org_type,
        mission: org.mission || '',
        functionTags: org.function_tags || [],
        headcount: org.headcount || 0,
        children: []
      }))});
    }
    set({ loading: false });
  },

  updateOrganization: async (orgId, updates) => {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.level) dbUpdates.level = updates.level;
    if (updates.orgType) dbUpdates.org_type = updates.orgType;
    if (updates.mission) dbUpdates.mission = updates.mission;
    if (updates.functionTags) dbUpdates.function_tags = updates.functionTags;
    if (updates.headcount) dbUpdates.headcount = updates.headcount;

    const { error } = await supabase.from('organizations').update(dbUpdates).eq('id', orgId);
    if (!error) {
      set(state => ({
        organizations: state.organizations.map(o => o.id === orgId ? { ...o, ...updates } : o)
      }));
    }
  },

  // ----------------------------------------------------
  // 2. Objective (목표)
  // ----------------------------------------------------
  fetchObjectives: async (orgId) => {
    const { data } = await supabase
      .from('objectives')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order');

    if (data) {
      set({ objectives: data.map(obj => ({
        id: obj.id,
        orgId: obj.org_id,
        name: obj.name,
        biiType: obj.bii_type,
        period: obj.period,
        status: obj.status,
        parentObjId: obj.parent_obj_id,
        order: obj.sort_order
      }))});
    }
  },

  addObjective: async (obj) => {
    // DB Insert
    const { data, error } = await supabase.from('objectives').insert({
      org_id: obj.orgId,
      name: obj.name,
      bii_type: obj.biiType,
      period: obj.period,
      status: obj.status,
      parent_obj_id: obj.parentObjId,
      sort_order: obj.order
    }).select().single();

    if (data) {
      // 로컬 State 추가
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
      set(state => ({ objectives: [...state.objectives, newObj] }));
    }
  },

  updateObjective: async (objId, updates) => {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.status) dbUpdates.status = updates.status;
    
    const { error } = await supabase.from('objectives').update(dbUpdates).eq('id', objId);
    if (!error) {
      set(state => ({
        objectives: state.objectives.map(o => o.id === objId ? { ...o, ...updates } : o)
      }));
    }
  },

  deleteObjective: async (objId) => {
    const { error } = await supabase.from('objectives').delete().eq('id', objId);
    if (!error) {
      set(state => ({
        objectives: state.objectives.filter(o => o.id !== objId)
      }));
    }
  },

  // ----------------------------------------------------
  // 3. Key Result (KR)
  // ----------------------------------------------------
  fetchKRs: async (orgId) => {
    // 해당 조직의 모든 KR과 마일스톤을 가져옵니다.
    const { data } = await supabase
      .from('key_results')
      .select(`
        *,
        milestones (*)
      `)
      .eq('org_id', orgId)
      .order('created_at'); // 정렬 기준

    if (data) {
      set({ krs: data.map((kr: any) => ({
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
          completed: m.completed
        })) : []
      }))});
    }
  },

  addKR: async (kr) => {
    // 1. KR Insert
    const { data: newKR, error } = await supabase.from('key_results').insert({
      objective_id: kr.objectiveId,
      org_id: kr.orgId,
      name: kr.name,
      // ...필요한 나머지 필드들 매핑 (양이 많으므로 생략 시 주의)
      unit: kr.unit,
      target_value: kr.targetValue,
      current_value: 0,
      bii_type: kr.biiType,
      status: 'active' // 기본값
    }).select().single();

    if (newKR) {
      // 2. Milestones Insert (있다면)
      if (kr.milestones && kr.milestones.length > 0) {
        const milestonesToInsert = kr.milestones.map(m => ({
          kr_id: newKR.id,
          text: m.text,
          quarter: m.quarter,
          completed: m.completed || false
        }));
        await supabase.from('milestones').insert(milestonesToInsert);
      }

      // 로컬 State 업데이트를 위해 fetch 다시 호출하는 게 가장 안전
      get().fetchKRs(kr.orgId); 
    }
  },

  updateKR: async (krId, updates) => {
    // 간단한 업데이트 예시
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;
    if (updates.name) dbUpdates.name = updates.name;

    const { error } = await supabase.from('key_results').update(dbUpdates).eq('id', krId);
    if (!error) {
      set(state => ({
        krs: state.krs.map(k => k.id === krId ? { ...k, ...updates } : k)
      }));
    }
  },

  deleteKR: async (krId) => {
    await supabase.from('key_results').delete().eq('id', krId);
    set(state => ({ krs: state.krs.filter(k => k.id !== krId) }));
  },

  // ----------------------------------------------------
  // Getters
  // ----------------------------------------------------
  getOrgById: (orgId) => get().organizations.find(o => o.id === orgId),
  getObjectivesByOrgId: (orgId) => get().objectives.filter(o => o.orgId === orgId),
  getKRsByObjectiveId: (objId) => get().krs.filter(k => k.objectiveId === objId),
}));