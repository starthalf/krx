import { create } from 'zustand';
import type { Company, Organization, Objective, DynamicKR, CFRThread, ActivityFeedItem, PoolKPI } from '../types';
import { mockCompany, mockOrganizations, mockObjectives, mockKRs, mockCFRThreads, mockActivityFeed, mockPoolKPIs } from '../data/mockData';

interface AppState {
  company: Company;
  organizations: Organization[];
  objectives: Objective[];
  krs: DynamicKR[];
  cfrThreads: CFRThread[];
  activityFeed: ActivityFeedItem[];
  poolKPIs: PoolKPI[];
  currentPeriod: string;
  selectedOrgId: string | null;

  setCurrentPeriod: (period: string) => void;
  setSelectedOrgId: (orgId: string | null) => void;

  getOrgById: (orgId: string) => Organization | undefined;
  getObjectivesByOrgId: (orgId: string) => Objective[];
  getKRsByOrgId: (orgId: string) => DynamicKR[];
  getKRsByObjectiveId: (objectiveId: string) => DynamicKR[];
  getCFRsByKRId: (krId: string) => CFRThread[];

  updateKR: (krId: string, updates: Partial<DynamicKR>) => void;
  addCFRThread: (thread: CFRThread) => void;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => void;
  addObjective: (objective: Objective) => void;
  addKR: (kr: DynamicKR) => void;
}

export const useStore = create<AppState>((set, get) => ({
  company: mockCompany,
  organizations: mockOrganizations,
  objectives: mockObjectives,
  krs: mockKRs,
  cfrThreads: mockCFRThreads,
  activityFeed: mockActivityFeed,
  poolKPIs: mockPoolKPIs,
  currentPeriod: '2025-H1',
  selectedOrgId: 'org-marketing',

  setCurrentPeriod: (period) => set({ currentPeriod: period }),
  setSelectedOrgId: (orgId) => set({ selectedOrgId: orgId }),

  getOrgById: (orgId) => {
    return get().organizations.find(org => org.id === orgId);
  },

  getObjectivesByOrgId: (orgId) => {
    return get().objectives.filter(obj => obj.orgId === orgId);
  },

  getKRsByOrgId: (orgId) => {
    return get().krs.filter(kr => kr.orgId === orgId);
  },

  getKRsByObjectiveId: (objectiveId) => {
    return get().krs.filter(kr => kr.objectiveId === objectiveId);
  },

  getCFRsByKRId: (krId) => {
    return get().cfrThreads.filter(cfr => cfr.krId === krId);
  },

  updateKR: (krId, updates) => {
    set(state => ({
      krs: state.krs.map(kr =>
        kr.id === krId ? { ...kr, ...updates } : kr
      )
    }));
  },

  addCFRThread: (thread) => {
    set(state => ({
      cfrThreads: [...state.cfrThreads, thread],
      activityFeed: [{
        id: `act-${Date.now()}`,
        type: 'feedback',
        user: thread.author,
        message: `${thread.type === 'Feedback' ? '피드백을' : '메시지를'} 남겼습니다`,
        timestamp: '방금 전'
      }, ...state.activityFeed]
    }));
  },

  updateOrganization: (orgId, updates) => {
    set(state => ({
      organizations: state.organizations.map(org =>
        org.id === orgId ? { ...org, ...updates } : org
      )
    }));
  },

  addObjective: (objective) => {
    set(state => ({
      objectives: [...state.objectives, objective]
    }));
  },

  addKR: (kr) => {
    set(state => ({
      krs: [...state.krs, kr]
    }));
  }
}));