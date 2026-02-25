// src/pages/AdminSettings.tsx
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Shield, Users, Layers, Lock, Settings as SettingsIcon, ChevronRight, 
  Building2, Mail, CalendarClock, ArrowLeft, X, Archive
} from 'lucide-react';
import UserRolesManager from '../components/admin/UserRolesManager';
import OrgStructureSettings from '../components/admin/OrgStructureSettings';
import OrgStructureManager from '../components/admin/OrgStructureManager';
import RolePermissionsManager from '../components/admin/RolePermissionsManager';
import CompanyManagement from '../components/admin/CompanyManagement';
import UserInvitation from '../components/admin/UserInvitation';
import UnifiedPeriodManager from '../components/admin/UnifiedPeriodManager';
import PeriodHistoryViewer from '../components/admin/PeriodHistoryViewer';
// ★ FIX: dynamic import 제거 → 정적 import
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'companies' | 'invite' | 'users' | 'roles' | 'structure' | 'levels' | 'permissions' | 'periods' | 'history';

const TAB_ALIASES: Record<string, TabType> = {
  'planning-cycles': 'periods',
  'cycles': 'periods',
  'periods': 'periods',
  'history': 'history',
  'period-history': 'history',
  'users': 'users',
  'invite': 'invite',
  'roles': 'roles',
  'structure': 'structure',
  'levels': 'levels',
  'permissions': 'permissions',
  'companies': 'companies',
};

export default function AdminSettings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();  // ★ FIX: AuthContext에서 user 가져오기
  const tabParam = searchParams.get('tab');
  const initialTab: TabType = (tabParam && TAB_ALIASES[tabParam]) || 'companies';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [userLevel, setUserLevel] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // URL 파라미터 변경 시 탭 동기화
  useEffect(() => {
    if (tabParam && TAB_ALIASES[tabParam]) {
      setActiveTab(TAB_ALIASES[tabParam]);
    }
  }, [tabParam]);

  // ★ FIX: user가 준비되면 권한 체크 실행
  //   이전: useEffect([], []) → 마운트 시 1회, 이때 user null이면 영영 안 됨
  //   이후: user?.id 의존성 → user 준비되면 실행, re-mount 시에도 정상 동작
  useEffect(() => {
    mountedRef.current = true;
    
    console.log('🔍 AdminSettings: useEffect, user =', user?.id || 'NULL');
    
    if (!user) {
      // user 아직 없으면 5초 안전장치
      const timeout = setTimeout(() => {
        if (mountedRef.current) {
          console.warn('⚠️ AdminSettings: 5초 타임아웃 — loading 해제');
          setLoading(false);
        }
      }, 5000);
      return () => { clearTimeout(timeout); mountedRef.current = false; };
    }

    checkUserPermissions(user.id);
    
    return () => { mountedRef.current = false; };
  }, [user?.id]);

  const checkUserPermissions = async (userId: string) => {
    console.log('🔍 AdminSettings: checkUserPermissions 시작');
    
    try {
      setLoading(true);

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select(`
          role:roles(level)
        `)
        .eq('profile_id', userId);

      console.log('🔍 AdminSettings: roles =', roles, 'error =', error);

      if (!mountedRef.current) return;

      if (error) {
        console.error('역할 조회 실패:', error);
      }

      const levels = (roles || [])
        .map(r => (r.role as any)?.level ?? 0)
        .filter((l): l is number => typeof l === 'number' && l > 0);
      const maxLevel = levels.length > 0 ? Math.max(...levels) : 0;
      
      console.log('🔍 AdminSettings: maxLevel =', maxLevel);
      
      setUserLevel(maxLevel);

      if (!tabParam) {
        if (maxLevel >= 100) {
          setActiveTab('companies');
        } else if (maxLevel >= 80) {
          setActiveTab('invite');
        } else {
          setActiveTab('users');
        }
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    } finally {
      if (mountedRef.current) {
        console.log('🔍 AdminSettings: loading = false');
        setLoading(false);
      }
    }
  };

  const tabs = [
    { id: 'companies' as TabType, name: '회사 관리', icon: Building2, description: '등록된 회사 목록 및 관리 (Super Admin)', minLevel: 100 },
    { id: 'invite' as TabType, name: '사용자 초대', icon: Mail, description: '새로운 팀원 초대 및 초대 관리', minLevel: 80 },
    { id: 'users' as TabType, name: '사용자 관리', icon: Users, description: '사용자별 역할 및 권한 할당', minLevel: 80 },
    { id: 'periods' as TabType, name: '기간 & 수립 관리', icon: CalendarClock, description: '기간 생성 및 OKR 수립 사이클 관리', minLevel: 80 },
    { id: 'history' as TabType, name: '성과 히스토리', icon: Archive, description: '마감된 기간의 성과 스냅샷 조회', minLevel: 80 },
    { id: 'structure' as TabType, name: '조직 편집', icon: Building2, description: '조직 추가/수정/삭제 및 AI 생성', minLevel: 80 },
    { id: 'levels' as TabType, name: '조직 계층', icon: Layers, description: '조직 계층 구조 템플릿 설정', minLevel: 80 },
    { id: 'roles' as TabType, name: '역할 관리', icon: Shield, description: '역할별 권한 설정 및 수정', minLevel: 80 },
    { id: 'permissions' as TabType, name: '권한 목록', icon: Lock, description: '전체 권한 목록 조회', minLevel: 80 },
  ];

  const visibleTabs = tabs.filter(tab => userLevel >= tab.minLevel);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="대시보드로 돌아가기"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <SettingsIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">관리자 설정</h1>
                  <p className="text-sm text-slate-600">권한 및 조직 구조 관리</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="닫기"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="flex-1 text-left text-sm">{tab.name}</span>
                  {activeTab === tab.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </div>

            <div className="mt-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-4">
              <h3 className="text-sm font-semibold text-purple-900 mb-2">💡 도움말</h3>
              <p className="text-xs text-purple-700 leading-relaxed">
                {activeTab === 'users' && '사용자에게 역할을 할당하거나 특정 조직에서의 권한을 설정할 수 있습니다.'}
                {activeTab === 'roles' && '각 역할(CEO, 관리자, 조직장 등)의 권한을 확인합니다.'}
                {activeTab === 'structure' && '조직을 추가, 수정, 삭제하거나 AI로 자동 생성할 수 있습니다.'}
                {activeTab === 'levels' && '회사의 조직 계층 구조(전사-본부-팀 등)를 정의합니다.'}
                {activeTab === 'permissions' && '시스템의 모든 권한 목록을 확인할 수 있습니다.'}
                {activeTab === 'periods' && '기간을 생성하고 OKR 수립 사이클을 관리합니다. 기간 활성화 → 수립 시작 → 진행 추적 → 마감 순서로 운영합니다.'}
                {activeTab === 'history' && '마감된 기간의 성과 스냅샷을 조회합니다. 전사 요약, 조직별 달성률, 등급 분포 등을 확인할 수 있습니다.'}
                {activeTab === 'companies' && '등록된 회사 목록을 관리하고 새 회사를 추가할 수 있습니다.'}
                {activeTab === 'invite' && '이메일로 새로운 팀원을 초대하거나 팀 초대 링크를 생성할 수 있습니다.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              {activeTab === 'companies' && <CompanyManagement />}
              {activeTab === 'invite' && <UserInvitation />}
              {activeTab === 'users' && <UserManagement />}
              {activeTab === 'roles' && <RoleManagement />}
              {activeTab === 'structure' && <StructureManagement />}
              {activeTab === 'levels' && <LevelSettings />}
              {activeTab === 'permissions' && <PermissionsList />}
              {activeTab === 'periods' && <UnifiedPeriodManager />}
              {activeTab === 'history' && <PeriodHistoryViewer />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserManagement() {
  return <UserRolesManager />;
}

function RoleManagement() {
  return <RolePermissionsManager />;
}

function StructureManagement() {
  return <OrgStructureManager />;
}

function LevelSettings() {
  return <OrgStructureSettings />;
}

function PermissionsList() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">권한 체계</h2>
        <p className="text-sm text-slate-600">
          상위 역할은 하위 역할의 모든 권한을 자동으로 포함합니다. (100 ⊃ 90 ⊃ 80 ⊃ 70 ⊃ 30 ⊃ 10)
        </p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 역할별 권한 요약</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>CEO (90):</strong> 전사 OKR 수립/승인 + 관리자 기능 전부</li>
          <li>• <strong>회사 관리자 (80):</strong> 조직/사용자/설정 관리 + 전사 조회</li>
          <li>• <strong>조직장 (70):</strong> 담당 조직 OKR 수립 + 하위 승인 (배정된 조직 범위)</li>
          <li>• <strong>구성원 (30):</strong> 개인 OKR + 체크인 + 피드백</li>
          <li>• <strong>조회자 (10):</strong> 공개 데이터 읽기 전용</li>
        </ul>
      </div>

      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h3 className="text-sm font-semibold text-amber-900 mb-2">🔑 접근 범위</h3>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• <strong>CEO/관리자:</strong> 전사 데이터 전체</li>
          <li>• <strong>조직장:</strong> 배정된 조직 + 하위 조직 (organizations 계층 기반)</li>
          <li>• <strong>구성원:</strong> 소속 조직만</li>
          <li>• <strong>조회자:</strong> 공개 설정된 데이터만</li>
        </ul>
      </div>
    </div>
  );
}