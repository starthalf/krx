// src/components/admin/RolePermissionsManager.tsx
import { useEffect, useState } from 'react';
import { getAllRoles, getRoleInfo, getMyRoleLevel, ROLE_LEVELS, Role } from '../../lib/permissions';
import { Shield, Check, Crown, Settings, Users, Target, BarChart3, Eye } from 'lucide-react';

const CAPABILITY_MATRIX = [
  { group: 'OKR 수립', items: [
    { name: '전사 OKR 수립/확정', minLevel: ROLE_LEVELS.CEO },
    { name: '초안 일괄 배포', minLevel: ROLE_LEVELS.CEO },
    { name: '수립 사이클 관리', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '조직 OKR 수립 (위저드)', minLevel: ROLE_LEVELS.ORG_LEADER },
    { name: 'OKR 제출', minLevel: ROLE_LEVELS.ORG_LEADER },
    { name: '개인 OKR 입력', minLevel: ROLE_LEVELS.MEMBER },
    { name: 'AI 생성 사용', minLevel: ROLE_LEVELS.ORG_LEADER },
  ]},
  { group: 'OKR 승인', items: [
    { name: '최종 승인 (전체)', minLevel: ROLE_LEVELS.CEO },
    { name: '하위 조직 승인/반려', minLevel: ROLE_LEVELS.ORG_LEADER },
    { name: '유관부서 검토 요청', minLevel: ROLE_LEVELS.ORG_LEADER },
  ]},
  { group: 'OKR 조회', items: [
    { name: '전사 OKR 조회', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '담당+하위 조직 조회', minLevel: ROLE_LEVELS.ORG_LEADER },
    { name: '본인 OKR 조회', minLevel: ROLE_LEVELS.MEMBER },
    { name: '공개 OKR 열람', minLevel: ROLE_LEVELS.VIEWER },
    { name: 'OKR Map 조회', minLevel: ROLE_LEVELS.ORG_LEADER },
  ]},
  { group: '체크인/피드백', items: [
    { name: '전사 체크인 대시보드', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '하위 체크인 조회/독촉', minLevel: ROLE_LEVELS.ORG_LEADER },
    { name: '본인 체크인', minLevel: ROLE_LEVELS.MEMBER },
    { name: '피드백/CFR', minLevel: ROLE_LEVELS.MEMBER },
  ]},
  { group: '대시보드', items: [
    { name: '전사 대시보드', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '담당+하위 대시보드', minLevel: ROLE_LEVELS.ORG_LEADER },
    { name: '개인 대시보드', minLevel: ROLE_LEVELS.MEMBER },
    { name: '리포트 내보내기', minLevel: ROLE_LEVELS.ORG_LEADER },
  ]},
  { group: '관리', items: [
    { name: '조직구조 관리', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '사용자 초대/역할 관리', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '기간(period) 관리', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: 'KPI Pool 관리', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '시스템 설정', minLevel: ROLE_LEVELS.COMPANY_ADMIN },
    { name: '회사 관리 (멀티테넌트)', minLevel: ROLE_LEVELS.SUPER_ADMIN },
  ]},
];

function getRoleIcon(level: number) {
  if (level >= 100) return Settings;
  if (level >= 90) return Crown;
  if (level >= 80) return Users;
  if (level >= 70) return Target;
  if (level >= 30) return BarChart3;
  return Eye;
}

export default function RolePermissionsManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await getAllRoles();
        const myLevel = await getMyRoleLevel();
        // ✅ super_admin이 아니면 level 100 역할 숨김
        const filtered = myLevel >= ROLE_LEVELS.SUPER_ADMIN
          ? data
          : data.filter(r => r.level < ROLE_LEVELS.SUPER_ADMIN);
        setRoles(filtered);
        if (filtered.length > 0) setSelectedRole(filtered[0]);
      } catch (error) {
        console.error('Failed to load roles:', error);
      }
    };
    loadRoles();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">역할 목록</h3>
          <p className="text-sm text-slate-600">역할별 권한을 확인하세요</p>
        </div>
        <div className="space-y-2">
          {roles.map((role) => {
            const info = getRoleInfo(role.level);
            const Icon = getRoleIcon(role.level);
            return (
              <button key={role.id} onClick={() => setSelectedRole(role)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRole?.id === role.id ? info.bgColor : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                <div className={`p-2 rounded-lg ${selectedRole?.id === role.id ? 'bg-white/60' : 'bg-slate-100'}`}>
                  <Icon className={`w-5 h-5 ${info.color}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{role.display_name}</div>
                  <div className="text-xs text-slate-500">레벨 {role.level}</div>
                </div>
                {selectedRole?.id === role.id && <Check className="w-5 h-5 text-blue-600" />}
              </button>
            );
          })}
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>상위 포함 원칙:</strong> 상위 역할은 하위 역할의 모든 권한을 자동으로 포함합니다.
          </p>
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedRole ? (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{selectedRole.display_name} 권한</h3>
              <p className="text-sm text-slate-600">{selectedRole.description}</p>
            </div>
            <div className="space-y-4">
              {CAPABILITY_MATRIX.map(({ group, items }) => {
                const activeItems = items.filter(item => selectedRole.level >= item.minLevel);
                return (
                  <div key={group} className="bg-white rounded-lg border border-slate-200 p-4">
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      {group}
                      <span className="text-xs font-normal text-slate-400">({activeItems.length}/{items.length})</span>
                    </h4>
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const hasAccess = selectedRole.level >= item.minLevel;
                        return (
                          <div key={item.name}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${hasAccess ? 'bg-green-50' : 'bg-slate-50 opacity-50'}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${hasAccess ? 'bg-green-500' : 'bg-slate-300'}`}>
                              {hasAccess ? <Check className="w-3 h-3 text-white" /> : <span className="w-2 h-2 bg-white rounded-full"></span>}
                            </div>
                            <span className={`text-sm ${hasAccess ? 'text-slate-900' : 'text-slate-400'}`}>{item.name}</span>
                            {hasAccess && item.minLevel === selectedRole.level && (
                              <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">이 역할부터</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-lg border border-slate-200">
            <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">왼쪽에서 역할을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}