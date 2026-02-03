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

  // Actions
  fetchOrganizations: (companyId: string) => Promise<void>;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<void>;
  
  // 기타 필요한 상태들 (일단 빈 배열/함수로 초기화)
  company: Company | null;
  getOrgById: (orgId: string) => Organization | undefined;
}

export const useStore = create<AppState>((set, get) => ({
  // 1. 초기값: 빈 배열로 시작
  organizations: [],
  objectives: [],
  krs: [],
  loading: false,
  company: null,

  // 2. 조직 목록 조회 (Supabase)
  fetchOrganizations: async (companyId: string) => {
    set({ loading: true });
    
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('조직 목록 조회 실패:', error);
    } else if (data) {
      // DB(snake_case) -> App(camelCase) 매핑
      const mappedOrgs: Organization[] = data.map(org => ({
        id: org.id,
        companyId: org.company_id,
        name: org.name,
        level: org.level,
        parentOrgId: org.parent_org_id,
        orgType: org.org_type,
        mission: org.mission || '',
        functionTags: org.function_tags || [],
        headcount: org.headcount || 0,
        // children은 UI에서 계산하므로 빈 배열
      }));
      set({ organizations: mappedOrgs });
    }
    set({ loading: false });
  },

  // 3. 조직 정보 수정 (Supabase + Optimistic Update)
  updateOrganization: async (orgId, updates) => {
    // DB 업데이트용 객체 변환 (camelCase -> snake_case)
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.level) dbUpdates.level = updates.level;
    if (updates.orgType) dbUpdates.org_type = updates.orgType;
    if (updates.mission) dbUpdates.mission = updates.mission;
    if (updates.functionTags) dbUpdates.function_tags = updates.functionTags;
    if (updates.headcount) dbUpdates.headcount = updates.headcount;

    // 1) Supabase 업데이트
    const { error } = await supabase
      .from('organizations')
      .update(dbUpdates)
      .eq('id', orgId);

    if (error) {
      console.error('조직 수정 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
      return; 
    }

    // 2) 성공 시 로컬 상태 업데이트
    set(state => ({
      organizations: state.organizations.map(org =>
        org.id === orgId ? { ...org, ...updates } : org
      )
    }));
  },

  getOrgById: (orgId) => get().organizations.find(org => org.id === orgId),
}));