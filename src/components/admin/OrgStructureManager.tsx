// ============================================
// OrgStructureManager.tsx 수정 사항
// ============================================

// 1. 인원수 표시 부분 수정 - headcount 대신 실제 배정 인원 표시
// 기존: {org.headcount}명
// 변경: 실제 user_roles에서 계산된 인원수

// ── OrgStructureManager.tsx에서 수정해야 할 부분들 ──

// [수정 1] 상태 추가 (컴포넌트 상단)
const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());

// [수정 2] useEffect 추가 - 조직별 실제 인원수 조회
useEffect(() => {
  const fetchMemberCounts = async () => {
    if (organizations.length === 0) return;
    
    try {
      // 모든 조직의 인원수를 한번에 조회
      const { data, error } = await supabase
        .from('user_roles')
        .select('org_id')
        .not('org_id', 'is', null);
      
      if (error) throw error;
      
      // org_id별로 카운트
      const counts = new Map<string, number>();
      (data || []).forEach((row: any) => {
        const orgId = row.org_id;
        counts.set(orgId, (counts.get(orgId) || 0) + 1);
      });
      
      setMemberCounts(counts);
    } catch (err) {
      console.error('Failed to fetch member counts:', err);
    }
  };
  
  fetchMemberCounts();
}, [organizations]);

// [수정 3] renderOrgTree 함수 내에서 인원수 표시 변경
// 기존:
// <span className="text-xs text-slate-500">{org.headcount}명</span>

// 변경:
// <span className="text-xs text-slate-500">{memberCounts.get(org.id) || 0}명</span>

// [수정 4] 조직 정보 패널의 인원수도 동일하게 변경
// 기존: <input type="number" value={selectedOrg.headcount || 0} ...
// 변경: 읽기 전용으로 실제 인원수 표시
// <div>
//   <label className="block text-xs font-medium text-slate-600 mb-1">배정 인원</label>
//   <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700">
//     {memberCounts.get(selectedOrg.id) || 0}명
//     <span className="text-xs text-slate-400 ml-2">(역할 배정 기준)</span>
//   </div>
// </div>

// ============================================
// 전체 수정된 코드 스니펫
// ============================================

// renderOrgTree 함수 내 수정:
const renderOrgTree = (org: Organization, level = 0): JSX.Element => {
  const children = getChildOrgs(org.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedOrgs.has(org.id);
  const isSelected = org.id === selectedOrgId;
  const actualMemberCount = memberCounts.get(org.id) || 0; // ★ 실제 인원수

  return (
    <div key={org.id}>
      <div
        onClick={() => setSelectedOrgId(org.id)}
        className={`group flex items-center gap-2 py-2.5 px-1 cursor-pointer rounded-lg transition-all text-slate-700 ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); toggleExpand(org.id); }} className="p-0.5">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{org.name}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`px-1.5 py-0.5 text-xs rounded border ${getOrgTypeColor(org.orgType)}`}>
              {org.orgType}
            </span>
            {/* ★ 수정: headcount 대신 실제 배정 인원수 */}
            <span className="text-xs text-slate-500">{actualMemberCount}명</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); openAddModal(org); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
          title="하위 조직 추가"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>{children.map(child => renderOrgTree(child, level + 1))}</div>
      )}
    </div>
  );
};

// 조직 정보 패널 내 인원수 부분 수정:
{selectedOrg && (
  <div className="space-y-4">
    {/* ... 다른 필드들 ... */}
    
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">배정 인원</label>
      <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50">
        <span className="font-medium text-slate-900">{memberCounts.get(selectedOrg.id) || 0}명</span>
        <span className="text-xs text-slate-400 ml-2">(역할 배정 기준)</span>
      </div>
    </div>
    
    {/* ... 나머지 필드들 ... */}
  </div>
)}