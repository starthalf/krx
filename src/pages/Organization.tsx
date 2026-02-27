// Organization.tsx 에서 return ( ... ) 내부의
// {/* 헤더 */} 부터 {/* 검색 및 필터 */} 닫는 </div> 까지 전체를 아래로 교체

      {/* 헤더 + 내 조직 + 통계 + 검색 — 컴팩트 1단 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900">조직 관리</h1>
          {/* 내 조직 바로가기 (인라인) */}
          {myOrgIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              {organizations
                .filter(o => myOrgIds.has(o.id))
                .map(org => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrgId(org.id);
                      const toExpand = new Set(expandedOrgs);
                      let current = organizations.find(o => o.id === org.parentOrgId);
                      while (current) {
                        toExpand.add(current.id);
                        current = organizations.find(o => o.id === current!.parentOrgId);
                      }
                      setExpandedOrgs(toExpand);
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      selectedOrgId === org.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    {org.name}
                  </button>
                ))
              }
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* 미니 통계 */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{stats.total}개 조직</span>
            <span className="text-slate-300">·</span>
            <span className="text-green-600">{stats.front}F</span>
            <span className="text-blue-600">{stats.middle}M</span>
            <span className="text-purple-600">{stats.back}B</span>
            {stats.totalHeadcount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span>{stats.totalHeadcount}명</span>
              </>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin?tab=structure')}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-xs font-medium"
            >
              <Settings className="w-3.5 h-3.5" /> 편집
            </button>
          )}
        </div>
      </div>

      {/* 검색 및 필터 — 한 줄 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="조직명 검색..."
            className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">전체</option>
          <option value="Front">Front</option>
          <option value="Middle">Middle</option>
          <option value="Back">Back</option>
        </select>
        <div className="flex border border-slate-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-2.5 py-1.5 text-sm ${viewMode === 'tree' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1.5 text-sm border-l ${viewMode === 'grid' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>