// src/pages/OKRStatus.tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import { ChevronRight, Target, TrendingUp, Edit, Trash2, Lock } from 'lucide-react';
import { getMyRoleLevel, checkCanManageOrg, checkPermission } from '../lib/permissions';

type ViewMode = 'company' | 'division' | 'team';

export default function OKRStatus() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { 
    organizations, 
    objectives,
    krs,
    fetchObjectives,
    fetchKRs 
  } = useStore();

  const [viewMode, setViewMode] = useState<ViewMode>('company');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  
  // 권한 관련
  const [roleLevel, setRoleLevel] = useState<number>(0);
  const [canManageCurrentOrg, setCanManageCurrentOrg] = useState<boolean>(false);
  const [canEditOKR, setCanEditOKR] = useState<boolean>(false);

  // 권한 체크
  useEffect(() => {
    const checkPermissions = async () => {
      const level = await getMyRoleLevel();
      setRoleLevel(level);
    };
    checkPermissions();
  }, []);

  // 현재 조직 관리 권한 확인
  useEffect(() => {
    const checkOrgPermission = async () => {
      if (selectedOrgId) {
        const canManage = await checkCanManageOrg(selectedOrgId);
        setCanManageCurrentOrg(canManage);
        
        // OKR 수정 권한 확인
        const canEdit = await checkPermission('okr.edit.team', selectedOrgId) || 
                        await checkPermission('okr.edit.division', selectedOrgId) ||
                        canManage;
        setCanEditOKR(canEdit);
      }
    };
    checkOrgPermission();
  }, [selectedOrgId]);

  // URL 기반 뷰 모드 결정
  useEffect(() => {
    if (location.pathname.includes('/okr/company')) {
      setViewMode('company');
    } else if (location.pathname.includes('/okr/division')) {
      setViewMode('division');
    } else if (location.pathname.includes('/okr/team')) {
      setViewMode('team');
    }
  }, [location.pathname]);

  const companyOrg = organizations.find(o => o.level === '전사');
  const divisions = organizations.filter(o => 
    o.level === '본부' && o.parentOrgId === companyOrg?.id
  );
  const teams = selectedOrgId 
    ? organizations.filter(o => o.level === '팀' && o.parentOrgId === selectedOrgId)
    : [];

  const getOrgStats = (orgId: string) => {
    const orgObjs = objectives.filter(o => o.orgId === orgId);
    const orgKRs = krs.filter(k => k.orgId === orgId);
    
    const avgProgress = orgKRs.length > 0
      ? Math.round(orgKRs.reduce((sum, kr) => sum + (kr.progressPct || 0), 0) / orgKRs.length)
      : 0;
    
    return {
      objectiveCount: orgObjs.length,
      krCount: orgKRs.length,
      avgProgress
    };
  };

  // 목표 카드에 수정/삭제 버튼 추가
  const ObjectiveCard = ({ objective, level }: { objective: any; level: number }) => {
    const objectiveKRs = krs.filter(k => k.objectiveId === objective.id);
    const progress = objectiveKRs.length > 0
      ? Math.round(objectiveKRs.reduce((sum, kr) => sum + (kr.progressPct || 0), 0) / objectiveKRs.length)
      : 0;

    return (
      <div 
        className={`bg-white rounded-lg border-2 border-slate-200 p-4 hover:border-blue-400 transition-all cursor-pointer ${
          level === 0 ? 'shadow-md' : ''
        }`}
        style={{ marginLeft: `${level * 40}px` }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getBIIColor(objective.biiType)}`}>
                {objective.biiType}
              </span>
              <span className="text-xs text-slate-500">{objectiveKRs.length} KRs</span>
              
              {/* 권한 없으면 잠금 아이콘 */}
              {!canEditOKR && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Lock className="w-3 h-3" />
                  <span>조회 전용</span>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{objective.name}</h3>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {/* 수정/삭제 버튼 - 권한 있을 때만 */}
            {canEditOKR && (
              <div className="flex gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/wizard/${objective.orgId}?edit=${objective.id}`);
                  }}
                  className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
                  title="수정"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('정말 삭제하시겠습니까?')) {
                      // 삭제 로직
                    }
                  }}
                  className="p-1.5 hover:bg-red-50 rounded text-red-600"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="text-right">
              <div className={`text-2xl font-bold ${
                progress >= 100 ? 'text-green-600' :
                progress >= 70 ? 'text-blue-600' :
                progress >= 40 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {progress}%
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-3">
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                progress >= 100 ? 'bg-green-500' :
                progress >= 70 ? 'bg-blue-500' :
                progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  const OrganizationCard = ({ org, onClick }: { org: any; onClick?: () => void }) => {
    const stats = getOrgStats(org.id);

    return (
      <div 
        onClick={onClick}
        className={`bg-white rounded-xl border-2 p-6 transition-all ${
          onClick ? 'border-blue-200 hover:border-blue-400 cursor-pointer hover:shadow-lg' : 'border-slate-200'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="text-sm text-slate-500 mb-1">{org.level} • {org.orgType}</div>
            <h3 className="text-xl font-bold text-slate-900">{org.name}</h3>
            {org.mission && (
              <p className="text-sm text-slate-600 mt-2">{org.mission}</p>
            )}
          </div>
          {onClick && <ChevronRight className="w-5 h-5 text-slate-400 mt-1" />}
        </div>
        
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.objectiveCount}</div>
            <div className="text-xs text-slate-500">목표</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.krCount}</div>
            <div className="text-xs text-slate-500">KR</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${
              stats.avgProgress >= 80 ? 'text-green-600' :
              stats.avgProgress >= 60 ? 'text-blue-600' :
              stats.avgProgress >= 40 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.avgProgress}%
            </div>
            <div className="text-xs text-slate-500">진행률</div>
          </div>
        </div>
      </div>
    );
  };

  // 데이터 로딩 로직들...
  useEffect(() => {
    if (viewMode === 'company' && companyOrg) {
      fetchObjectives(companyOrg.id);
      fetchKRs(companyOrg.id);
      divisions.forEach(div => {
        fetchObjectives(div.id);
        fetchKRs(div.id);
      });
    }
  }, [viewMode, companyOrg, divisions.length]);

  useEffect(() => {
    if (viewMode === 'division' && selectedOrgId) {
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
      const divTeams = organizations.filter(o => o.level === '팀' && o.parentOrgId === selectedOrgId);
      divTeams.forEach(team => {
        fetchObjectives(team.id);
        fetchKRs(team.id);
      });
    }
  }, [viewMode, selectedOrgId]);

  useEffect(() => {
    if (viewMode === 'team' && selectedOrgId) {
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
    }
  }, [viewMode, selectedOrgId]);

  useEffect(() => {
    if (viewMode === 'division') {
      const currentOrg = organizations.find(o => o.id === selectedOrgId);
      if (!currentOrg || currentOrg.level !== '본부') {
        if (divisions.length > 0) {
          setSelectedOrgId(divisions[0].id);
        }
      }
    }
  }, [viewMode, divisions.length]);

  useEffect(() => {
    if (viewMode === 'team') {
      const allTeams = organizations.filter(o => o.level === '팀');
      const currentOrg = organizations.find(o => o.id === selectedOrgId);
      if (!currentOrg || currentOrg.level !== '팀') {
        if (allTeams.length > 0) {
          setSelectedOrgId(allTeams[0].id);
        }
      }
    }
  }, [viewMode, organizations.length]);

  const renderCompanyView = () => {
    if (!companyOrg) {
      return (
        <div className="text-center text-slate-500 py-20">
          전사 조직 데이터가 없습니다
        </div>
      );
    }

    const companyObjectives = objectives.filter(o => o.orgId === companyOrg.id);

    return (
      <div className="space-y-8">
        <OrganizationCard org={companyOrg} />

        {companyObjectives.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5" />
              전사 목표
            </h3>
            {companyObjectives.map(obj => (
              <ObjectiveCard key={obj.id} objective={obj} level={0} />
            ))}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            본부별 현황
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {divisions.map(div => (
              <OrganizationCard 
                key={div.id} 
                org={div} 
                onClick={() => {
                  setSelectedOrgId(div.id);
                  navigate('/okr/division');
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDivisionView = () => {
    if (!selectedOrgId) {
      return <div className="text-center text-slate-500 py-20">본부를 선택해주세요</div>;
    }

    const selectedDiv = organizations.find(o => o.id === selectedOrgId);
    if (!selectedDiv) return null;

    const divObjectives = objectives.filter(o => o.orgId === selectedOrgId);

    return (
      <div className="space-y-8">
        <select 
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {divisions.map(div => (
            <option key={div.id} value={div.id}>{div.name}</option>
          ))}
        </select>

        <OrganizationCard org={selectedDiv} />

        {divObjectives.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5" />
              본부 목표
            </h3>
            {divObjectives.map(obj => (
              <ObjectiveCard key={obj.id} objective={obj} level={0} />
            ))}
          </div>
        )}

        {teams.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              팀별 현황
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map(team => (
                <OrganizationCard 
                  key={team.id} 
                  org={team} 
                  onClick={() => {
                    setSelectedOrgId(team.id);
                    navigate('/okr/team');
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTeamView = () => {
    if (!selectedOrgId) {
      return <div className="text-center text-slate-500 py-20">팀을 선택해주세요</div>;
    }

    const selectedTeam = organizations.find(o => o.id === selectedOrgId);
    if (!selectedTeam) return null;

    const teamObjectives = objectives.filter(o => o.orgId === selectedOrgId);
    const allTeams = organizations.filter(o => o.level === '팀');

    return (
      <div className="space-y-8">
        <select 
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {allTeams.map(team => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>

        <OrganizationCard org={selectedTeam} />

        {teamObjectives.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5" />
                팀 목표 및 KR
              </h3>
              
              {/* 목표 수립 버튼 - 권한 있을 때만 */}
              {canManageCurrentOrg && (
                <button
                  onClick={() => navigate(`/wizard/${selectedOrgId}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  + 목표 추가
                </button>
              )}
            </div>
            
            {teamObjectives.map(obj => {
              const objKRs = krs.filter(k => k.objectiveId === obj.id);
              return (
                <div key={obj.id} className="space-y-3">
                  <ObjectiveCard objective={obj} level={0} />
                  {objKRs.map(kr => (
                    <div 
                      key={kr.id} 
                      className="ml-10 bg-slate-50 rounded-lg border border-slate-200 p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">{kr.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {kr.currentValue} / {kr.targetValue} {kr.unit}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-slate-700">
                        {kr.progressPct}%
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            
            <div className="mt-6 pt-6 border-t border-slate-200">
              <button
                onClick={() => navigate('/checkin')}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                상세 관리 및 실적 입력 →
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-10 text-center">
            <p className="text-yellow-800 mb-2">아직 설정된 목표가 없습니다</p>
            
            {/* 목표 수립 버튼 - 권한 있을 때만 */}
            {canManageCurrentOrg ? (
              <button
                onClick={() => navigate(`/wizard/${selectedOrgId}`)}
                className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                목표 수립하기
              </button>
            ) : (
              <p className="text-sm text-yellow-700 mt-2">
                목표 수립 권한이 없습니다. 팀장에게 문의하세요.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="text-sm text-slate-500 mb-1">목표 현황</div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            {viewMode === 'company' && '전사 OKR'}
            {viewMode === 'division' && '본부별 OKR'}
            {viewMode === 'team' && '팀별 OKR'}
          </h1>
          
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/okr/company')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'company'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              전사
            </button>
            <button
              onClick={() => navigate('/okr/division')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'division'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              본부
            </button>
            <button
              onClick={() => navigate('/okr/team')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'team'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              팀
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'company' && renderCompanyView()}
      {viewMode === 'division' && renderDivisionView()}
      {viewMode === 'team' && renderTeamView()}
    </div>
  );
}