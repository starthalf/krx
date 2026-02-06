// src/pages/AdminSettings.tsx
import { useState } from 'react';
import { Shield, Users, Layers, Lock, Settings as SettingsIcon, ChevronRight } from 'lucide-react';

type TabType = 'users' | 'roles' | 'structure' | 'permissions';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('users');

  const tabs = [
    { id: 'users' as TabType, name: '사용자 관리', icon: Users, description: '사용자별 역할 및 권한 할당' },
    { id: 'roles' as TabType, name: '역할 관리', icon: Shield, description: '역할별 권한 설정 및 수정' },
    { id: 'structure' as TabType, name: '조직 구조', icon: Layers, description: '조직 계층 템플릿 설정' },
    { id: 'permissions' as TabType, name: '권한 목록', icon: Lock, description: '전체 권한 목록 조회' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">관리자 설정</h1>
              <p className="text-sm text-slate-600 mt-1">권한 및 조직 구조 관리</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 왼쪽 사이드바 - 탭 메뉴 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              {tabs.map((tab) => (
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

            {/* 도움말 카드 */}
            <div className="mt-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-4">
              <h3 className="text-sm font-semibold text-purple-900 mb-2">💡 도움말</h3>
              <p className="text-xs text-purple-700 leading-relaxed">
                {activeTab === 'users' && '사용자에게 역할을 할당하거나 특정 조직에서의 권한을 설정할 수 있습니다.'}
                {activeTab === 'roles' && '각 역할(팀장, 본부장 등)이 가질 수 있는 권한을 설정합니다.'}
                {activeTab === 'structure' && '회사의 조직 계층 구조(전사-본부-팀 등)를 정의합니다.'}
                {activeTab === 'permissions' && '시스템의 모든 권한 목록을 확인할 수 있습니다.'}
              </p>
            </div>
          </div>

          {/* 오른쪽 컨텐츠 영역 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              {activeTab === 'users' && <UserManagement />}
              {activeTab === 'roles' && <RoleManagement />}
              {activeTab === 'structure' && <StructureManagement />}
              {activeTab === 'permissions' && <PermissionsList />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 1. 사용자 관리 컴포넌트
// ============================================
function UserManagement() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">사용자 역할 관리</h2>
        <p className="text-sm text-slate-600">각 사용자의 역할과 권한을 관리합니다.</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          🚧 <strong>준비중</strong> - UserRolesManager 컴포넌트를 여기에 통합 예정입니다.
        </p>
      </div>

      {/* 임시 사용자 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold">S</span>
            </div>
            <div>
              <div className="font-semibold text-slate-900">steve</div>
              <div className="text-xs text-slate-500">gepes88@gmail.com</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
              시스템 관리자
            </span>
            <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded">
              수정
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold">김</span>
            </div>
            <div>
              <div className="font-semibold text-slate-900">김테크</div>
              <div className="text-xs text-slate-500">hcgkhlee@gmail.com</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              본부장
            </span>
            <span className="text-xs text-slate-500">영업본부</span>
            <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded">
              수정
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold">관</span>
            </div>
            <div>
              <div className="font-semibold text-slate-900">관리자</div>
              <div className="text-xs text-slate-500">demo@okrio.kr</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              팀장
            </span>
            <span className="text-xs text-slate-500">B2B영업팀</span>
            <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded">
              수정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 2. 역할 관리 컴포넌트
// ============================================
function RoleManagement() {
  const roles = [
    { name: 'super_admin', displayName: '시스템 관리자', level: 100, permissions: 33, color: 'purple' },
    { name: 'company_admin', displayName: '회사 관리자', level: 90, permissions: 12, color: 'blue' },
    { name: 'division_head', displayName: '본부장', level: 70, permissions: 10, color: 'indigo' },
    { name: 'team_leader', displayName: '팀장', level: 50, permissions: 9, color: 'green' },
    { name: 'team_member', displayName: '팀원', level: 30, permissions: 7, color: 'yellow' },
    { name: 'viewer', displayName: '조회자', level: 10, permissions: 4, color: 'slate' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">역할별 권한 설정</h2>
        <p className="text-sm text-slate-600">각 역할이 가진 권한을 확인하고 수정합니다.</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          🚧 <strong>준비중</strong> - RolePermissionsManager 컴포넌트를 여기에 통합 예정입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <div key={role.name} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-${role.color}-100 rounded-lg flex items-center justify-center`}>
                  <Shield className={`w-5 h-5 text-${role.color}-600`} />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{role.displayName}</div>
                  <div className="text-xs text-slate-500">레벨 {role.level}</div>
                </div>
              </div>
              <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded">
                수정
              </button>
            </div>
            <div className="text-sm text-slate-600">
              권한 {role.permissions}개 보유
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 3. 조직 구조 관리 컴포넌트
// ============================================
function StructureManagement() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">조직 계층 구조 설정</h2>
        <p className="text-sm text-slate-600">회사의 조직 계층을 정의합니다 (전사 → 본부 → 팀 등).</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          🚧 <strong>준비중</strong> - OrgStructureSettings 컴포넌트를 여기에 통합 예정입니다.
        </p>
      </div>

      {/* 현재 구조 미리보기 */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-xs font-bold text-blue-600">
            1
          </div>
          <div>
            <div className="font-semibold text-slate-900">전사</div>
            <div className="text-xs text-slate-500">필수 레벨</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 ml-6">
          <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center text-xs font-bold text-indigo-600">
            2
          </div>
          <div>
            <div className="font-semibold text-slate-900">본부</div>
            <div className="text-xs text-slate-500">필수 레벨</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 ml-12">
          <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center text-xs font-bold text-purple-600">
            3
          </div>
          <div>
            <div className="font-semibold text-slate-900">실</div>
            <div className="text-xs text-slate-500">선택 레벨</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 ml-12">
          <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center text-xs font-bold text-green-600">
            4
          </div>
          <div>
            <div className="font-semibold text-slate-900">팀</div>
            <div className="text-xs text-slate-500">필수 레벨</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 ml-12">
          <div className="w-8 h-8 bg-yellow-100 rounded flex items-center justify-center text-xs font-bold text-yellow-600">
            5
          </div>
          <div>
            <div className="font-semibold text-slate-900">개인</div>
            <div className="text-xs text-slate-500">필수 레벨</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 4. 권한 목록 컴포넌트
// ============================================
function PermissionsList() {
  const permissionCategories = [
    { category: 'OKR', count: 12, color: 'blue' },
    { category: 'CheckIn', count: 5, color: 'green' },
    { category: 'Result', count: 3, color: 'purple' },
    { category: 'Organization', count: 4, color: 'indigo' },
    { category: 'User', count: 6, color: 'yellow' },
    { category: 'System', count: 2, color: 'red' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">전체 권한 목록</h2>
        <p className="text-sm text-slate-600">시스템의 모든 권한을 카테고리별로 확인합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {permissionCategories.map((cat) => (
          <div key={cat.category} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lock className={`w-5 h-5 text-${cat.color}-600`} />
                <div className="font-semibold text-slate-900">{cat.category}</div>
              </div>
              <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded">
                {cat.count}개
              </span>
            </div>
            <button className="text-sm text-blue-600 hover:underline">
              상세 보기 →
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 권한 구조</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>보기 권한:</strong> own (본인) → team (팀) → division (본부) → all (전사)</li>
          <li>• <strong>수정 권한:</strong> 상위 레벨일수록 더 많은 범위 수정 가능</li>
          <li>• <strong>시스템 권한:</strong> 회사 관리자 이상만 보유</li>
        </ul>
      </div>
    </div>
  );
}