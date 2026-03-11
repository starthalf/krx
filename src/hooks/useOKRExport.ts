// src/hooks/useOKRExport.ts
// OKR 데이터를 Excel(.xlsx)로 다운로드하는 훅
// 사용법: const { exportOKR, loading } = useOKRExport();
//         await exportOKR({ orgIds: [...], periodCode: '2025-Q1', companyName: '...' });

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

export interface OKRExportOptions {
  orgIds: string[];           // 내보낼 조직 ID 목록 (빈 배열이면 전체)
  periodCode: string;         // 기간 코드 ex) '2025-Q1'
  companyName?: string;       // 파일명/시트 제목용
  includeKRDetail?: boolean;  // KR 상세(정의·산식 등) 포함 여부
}

interface OrgRow {
  id: string;
  name: string;
  level: string;
}

interface ObjRow {
  id: string;
  org_id: string;
  name: string;
  bii_type: string;
  approval_status: string;
  sort_order: number;
}

interface KRRow {
  id: string;
  objective_id: string;
  org_id: string;
  name: string;
  definition: string;
  formula: string;
  unit: string;
  weight: number;
  target_value: number;
  current_value: number;
  bii_type: string;
  perspective: string;
  indicator_type: string;
  measurement_cycle: string;
  kpi_category: string;
}

// BII 타입 한글 변환
function biiLabel(b: string) {
  if (b === 'Build') return 'Build(구축)';
  if (b === 'Innovate') return 'Innovate(혁신)';
  return 'Improve(개선)';
}

// 승인 상태 한글 변환
function approvalLabel(s: string) {
  const map: Record<string, string> = {
    ai_draft: 'AI초안',
    draft: '작성중',
    submitted: '제출됨',
    under_review: '검토중',
    revision_requested: '수정요청',
    manager_approved: '관리자승인',
    ceo_approved: 'CEO승인',
    approved: '승인',
    finalized: '확정',
  };
  return map[s] ?? s;
}

// 계층 레벨 정렬 가중치
const LEVEL_ORDER: Record<string, number> = {
  전사: 0, 부문: 1, 본부: 2, 국: 3, 부: 4, 실: 5, 팀: 6, 센터: 7,
};

export function useOKRExport() {
  const [loading, setLoading] = useState(false);

  const exportOKR = async (options: OKRExportOptions) => {
    const { orgIds, periodCode, companyName = '', includeKRDetail = true } = options;
    setLoading(true);

    try {
      // ── 1. 조직 정보 ──────────────────────────────────
      let orgQuery = supabase
        .from('organizations')
        .select('id, name, level')
        .order('level');

      if (orgIds.length > 0) {
        orgQuery = orgQuery.in('id', orgIds);
      }

      const { data: orgs, error: orgErr } = await orgQuery;
      if (orgErr) throw orgErr;

      const orgList: OrgRow[] = (orgs ?? []).sort(
        (a, b) => (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99),
      );
      const orgMap = new Map(orgList.map(o => [o.id, o]));

      // ── 2. Objectives ──────────────────────────────────
      let objQuery = supabase
        .from('objectives')
        .select('id, org_id, name, bii_type, approval_status, sort_order')
        .eq('period', periodCode)
        // approval_status 없는 초안(null)도 포함
        .order('sort_order');

      if (orgIds.length > 0) {
        objQuery = objQuery.in('org_id', orgIds);
      }

      const { data: objs, error: objErr } = await objQuery;
      if (objErr) throw objErr;

      // ── 3. Key Results ─────────────────────────────────
      const objIds = (objs ?? []).map(o => o.id);
      let krs: KRRow[] = [];

      if (objIds.length > 0) {
        const { data: krData, error: krErr } = await supabase
          .from('key_results')
          .select(
            'id, objective_id, org_id, name, definition, formula, unit, weight, ' +
            'target_value, current_value, bii_type, perspective, indicator_type, ' +
            'measurement_cycle, kpi_category',
          )
          .in('objective_id', objIds)
          .order('weight', { ascending: false });

        if (krErr) throw krErr;
        krs = (krData ?? []) as KRRow[];
      }

      // ── 4. 데이터 매핑 (조직별 그룹화) ────────────────
      const objsByOrg = new Map<string, ObjRow[]>();
      for (const obj of objs ?? []) {
        const list = objsByOrg.get(obj.org_id) ?? [];
        list.push(obj as ObjRow);
        objsByOrg.set(obj.org_id, list);
      }

      const krsByObj = new Map<string, KRRow[]>();
      for (const kr of krs) {
        const list = krsByObj.get(kr.objective_id) ?? [];
        list.push(kr);
        krsByObj.set(kr.objective_id, list);
      }

      // ── 5. Excel 워크북 생성 ───────────────────────────
      const wb = XLSX.utils.book_new();

      // ── 5-1. [전체 요약] 시트 ─────────────────────────
      const summaryRows: any[][] = [
        // 제목 행
        [`${companyName} OKR 현황 (${periodCode})`],
        [],
        ['조직명', '레벨', 'Objective 수', 'KR 수', '평균 달성률(%)'],
      ];

      for (const org of orgList) {
        const orgObjs = objsByOrg.get(org.id) ?? [];
        const orgKRs = orgObjs.flatMap(o => krsByObj.get(o.id) ?? []);
        const avgRate =
          orgKRs.length > 0
            ? Math.round(
                (orgKRs.reduce((sum, kr) => {
                  const rate =
                    kr.target_value > 0
                      ? Math.min((kr.current_value / kr.target_value) * 100, 150)
                      : 0;
                  return sum + rate;
                }, 0) /
                  orgKRs.length) *
                  10,
              ) / 10
            : '-';

        summaryRows.push([org.name, org.level, orgObjs.length, orgKRs.length, avgRate]);
      }

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [
        { wch: 24 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 16 },
      ];
      summarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
      XLSX.utils.book_append_sheet(wb, summarySheet, '전체 요약');

      // ── 5-2. [OKR 상세] 시트 ──────────────────────────
      const detailHeaders = includeKRDetail
        ? [
            '조직명', '레벨',
            'O번호', 'Objective', 'BII', 'O 상태',
            'KR번호', 'KR명', '구분', '관점', '측정주기',
            '가중치(%)', '목표값', '현재값', '달성률(%)', '단위',
            'KR 정의', '산식',
          ]
        : [
            '조직명', '레벨',
            'O번호', 'Objective', 'BII', 'O 상태',
            'KR번호', 'KR명', '가중치(%)', '목표값', '현재값', '달성률(%)', '단위',
          ];

      const detailRows: any[][] = [detailHeaders];

      for (const org of orgList) {
        const orgObjs = objsByOrg.get(org.id) ?? [];
        if (orgObjs.length === 0) continue;

        for (let oi = 0; oi < orgObjs.length; oi++) {
          const obj = orgObjs[oi];
          const objKRs = krsByObj.get(obj.id) ?? [];

          if (objKRs.length === 0) {
            // KR 없는 Objective
            if (includeKRDetail) {
              detailRows.push([
                org.name, org.level,
                oi + 1, obj.name, biiLabel(obj.bii_type), approvalLabel(obj.approval_status),
                '', '', '', '', '', '', '', '', '', '', '', '',
              ]);
            } else {
              detailRows.push([
                org.name, org.level,
                oi + 1, obj.name, biiLabel(obj.bii_type), approvalLabel(obj.approval_status),
                '', '', '', '', '', '', '',
              ]);
            }
            continue;
          }

          for (let ki = 0; ki < objKRs.length; ki++) {
            const kr = objKRs[ki];
            const rate =
              kr.target_value > 0
                ? Math.round((kr.current_value / kr.target_value) * 1000) / 10
                : 0;

            if (includeKRDetail) {
              detailRows.push([
                ki === 0 ? org.name : '',
                ki === 0 ? org.level : '',
                ki === 0 ? oi + 1 : '',
                ki === 0 ? obj.name : '',
                ki === 0 ? biiLabel(obj.bii_type) : '',
                ki === 0 ? approvalLabel(obj.approval_status) : '',
                ki + 1,
                kr.name,
                kr.indicator_type ?? '',
                kr.perspective ?? '',
                kr.measurement_cycle ?? '',
                kr.weight,
                kr.target_value,
                kr.current_value,
                rate,
                kr.unit ?? '',
                kr.definition ?? '',
                kr.formula ?? '',
              ]);
            } else {
              detailRows.push([
                ki === 0 ? org.name : '',
                ki === 0 ? org.level : '',
                ki === 0 ? oi + 1 : '',
                ki === 0 ? obj.name : '',
                ki === 0 ? biiLabel(obj.bii_type) : '',
                ki === 0 ? approvalLabel(obj.approval_status) : '',
                ki + 1,
                kr.name,
                kr.weight,
                kr.target_value,
                kr.current_value,
                rate,
                kr.unit ?? '',
              ]);
            }
          }
        }
      }

      const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
      detailSheet['!cols'] = includeKRDetail
        ? [
            { wch: 20 }, { wch: 7 },
            { wch: 6 }, { wch: 36 }, { wch: 14 }, { wch: 10 },
            { wch: 6 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 },
            { wch: 30 }, { wch: 30 },
          ]
        : [
            { wch: 20 }, { wch: 7 },
            { wch: 6 }, { wch: 36 }, { wch: 14 }, { wch: 10 },
            { wch: 6 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 },
          ];

      XLSX.utils.book_append_sheet(wb, detailSheet, 'OKR 상세');

      // ── 5-3. 조직별 개별 시트 ─────────────────────────
      for (const org of orgList) {
        const orgObjs = objsByOrg.get(org.id) ?? [];
        if (orgObjs.length === 0) continue;

        const sheetRows: any[][] = [
          [`${org.name} OKR (${periodCode})`],
          [],
          ['O번호', 'Objective', 'BII', '상태', 'KR번호', 'KR명', '가중치(%)', '목표값', '현재값', '달성률(%)', '단위'],
        ];

        for (let oi = 0; oi < orgObjs.length; oi++) {
          const obj = orgObjs[oi];
          const objKRs = krsByObj.get(obj.id) ?? [];

          if (objKRs.length === 0) {
            sheetRows.push([oi + 1, obj.name, biiLabel(obj.bii_type), approvalLabel(obj.approval_status), '', '', '', '', '', '', '']);
            continue;
          }

          for (let ki = 0; ki < objKRs.length; ki++) {
            const kr = objKRs[ki];
            const rate =
              kr.target_value > 0
                ? Math.round((kr.current_value / kr.target_value) * 1000) / 10
                : 0;

            sheetRows.push([
              ki === 0 ? oi + 1 : '',
              ki === 0 ? obj.name : '',
              ki === 0 ? biiLabel(obj.bii_type) : '',
              ki === 0 ? approvalLabel(obj.approval_status) : '',
              ki + 1,
              kr.name,
              kr.weight,
              kr.target_value,
              kr.current_value,
              rate,
              kr.unit ?? '',
            ]);
          }
        }

        const orgSheet = XLSX.utils.aoa_to_sheet(sheetRows);
        orgSheet['!cols'] = [
          { wch: 6 }, { wch: 36 }, { wch: 14 }, { wch: 10 },
          { wch: 6 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 },
        ];
        orgSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];

        // 시트 이름: 30자 제한, 특수문자 제거
        const sheetName = org.name.replace(/[\\/*?[\]:]/g, '').slice(0, 30);
        XLSX.utils.book_append_sheet(wb, orgSheet, sheetName);
      }

      // ── 6. 파일 다운로드 ──────────────────────────────
      const fileName = `OKR_${companyName ? companyName + '_' : ''}${periodCode}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } finally {
      setLoading(false);
    }
  };

  return { exportOKR, loading };
}