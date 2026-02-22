// src/components/admin/OKRPolicySettings.tsx
// OKR 정책 설정 — 수립 주기(연/반기/분기) 등 회사 OKR 운영 정책 관리
// ✅ companies 테이블의 okr_cycle_unit 컬럼 사용

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, AlertTriangle, CheckCircle2, Info, Calendar,
  RefreshCw, Shield, ArrowRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type CycleUnit = 'year' | 'half' | 'quarter';

interface OKRPolicy {
  okr_cycle_unit: CycleUnit;
  updated_at: string | null;
}

const CYCLE_OPTIONS: { value: CycleUnit; label: string; emoji: string; desc: string; warning?: string }[] = [
  {
    value: 'year',
    label: '연도 단위',
    emoji: '📅',
    desc: '연간 전략 목표를 한 번 수립하고, 체크인으로 진행 상황을 추적합니다.',
  },
  {
    value: 'half',
    label: '반기 단위',
    emoji: '📆',
    desc: '6개월마다 핵심 목표를 수립합니다. 전략과 실행의 균형에 적합합니다.',
    warning: '연 2회 OKR 수립·합의·확정 과정을 반복해야 합니다.',
  },
  {
    value: 'quarter',
    label: '분기 단위',
    emoji: '🗓️',
    desc: '3개월마다 실행 목표를 수립합니다. 빠른 피드백과 민첩한 운영에 적합합니다.',
    warning: '연 4회 수립 사이클을 운영해야 하므로 조직 부담이 큽니다. 충분한 운영 역량이 확보된 조직에 권장합니다.',
  },
];

export default function OKRPolicySettings() {
  const { user, profile } = useAuth();
  const companyId = profile?.company_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState<OKRPolicy | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<CycleUnit>('year');
  const [showChangeConfirm, setShowChangeConfirm] = useState(false);

  // ─── Load ──────────────────────────────────────────────

  const loadPolicy = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('okr_cycle_unit, updated_at')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      const policy: OKRPolicy = {
        okr_cycle_unit: data?.okr_cycle_unit || 'year',
        updated_at: data?.updated_at || null,
      };
      setCurrentPolicy(policy);
      setSelectedUnit(policy.okr_cycle_unit);
    } catch (err: any) {
      console.error('정책 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadPolicy(); }, [loadPolicy]);

  // ─── Save ──────────────────────────────────────────────

  const handleSave = async () => {
    if (!companyId || !user?.id) return;

    // 변경 사항이 없으면 스킵
    if (currentPolicy?.okr_cycle_unit === selectedUnit) {
      alert('변경 사항이 없습니다.');
      return;
    }

    // 기존 정책이 있고 변경하려는 경우 → 확인 모달
    if (currentPolicy && currentPolicy.okr_cycle_unit !== selectedUnit) {
      setShowChangeConfirm(true);
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ okr_cycle_unit: selectedUnit })
        .eq('id', companyId);
      if (error) throw error;
      alert('OKR 정책이 저장되었습니다.');
      setShowChangeConfirm(false);
      loadPolicy();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isChanged = currentPolicy?.okr_cycle_unit !== selectedUnit;
  const currentLabel = CYCLE_OPTIONS.find(o => o.value === currentPolicy?.okr_cycle_unit)?.label || '-';
  const newLabel = CYCLE_OPTIONS.find(o => o.value === selectedUnit)?.label || '-';

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
        로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          회사 OKR 정책
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          OKR 수립 주기 및 운영 정책을 설정합니다. 이 설정은 기간 생성과 수립 플로우에 반영됩니다.
        </p>
      </div>

      {/* 현재 정책 표시 */}
      {currentPolicy && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <span className="text-sm font-medium text-blue-900">현재 수립 주기: </span>
            <span className="text-sm font-bold text-blue-700">{currentLabel}</span>
          </div>
        </div>
      )}

      {/* 수립 주기 선택 */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-3">수립 주기 설정</label>
        <div className="space-y-3">
          {CYCLE_OPTIONS.map(opt => {
            const isSelected = selectedUnit === opt.value;
            const isCurrent = currentPolicy?.okr_cycle_unit === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelectedUnit(opt.value)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{opt.emoji}</span>
                      <span className="font-semibold text-slate-900">{opt.label}</span>
                      {isCurrent && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">현재</span>}
                      {opt.value === 'year' && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">추천</span>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{opt.desc}</p>
                    {opt.warning && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>{opt.warning}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!isChanged || saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? '저장 중...' : '정책 저장'}
        </button>
        {isChanged && (
          <span className="text-sm text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            변경 사항이 있습니다
          </span>
        )}
      </div>

      {/* 안내 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-slate-500" /> 정책 변경 안내
        </h3>
        <ul className="text-xs text-slate-600 space-y-1.5">
          <li>• 수립 주기를 변경하면 <strong>"기간 관리"</strong> 탭에서 해당 단위의 기간만 생성할 수 있습니다.</li>
          <li>• 기존 진행 중이던 OKR 사이클은 현재 상태 그대로 유지됩니다.</li>
          <li>• 새 주기로 전환 시, 기존 기간은 아카이빙되고 새 기간에서 OKR을 다시 수립해야 합니다.</li>
          <li>• 정책 변경은 언제든 가능하지만, 기존 데이터와의 연속성이 끊어지므로 신중하게 결정하세요.</li>
        </ul>
      </div>

      {/* 변경 확인 모달 */}
      {showChangeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">수립 주기 변경 확인</h3>
                <p className="text-sm text-slate-600">정책 변경의 영향을 확인하세요</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-slate-700">{currentLabel}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-blue-700">{newLabel}</span>
              </div>
              <ul className="text-sm text-amber-800 space-y-2">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>기존 진행 중이던 OKR 사이클과의 <strong>연속성이 끊어집니다.</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>새 주기에 맞는 기간을 생성하고, <strong>OKR을 처음부터 다시 수립</strong>해야 합니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>기존 기간의 OKR 데이터는 보존되지만 <strong>아카이빙</strong> 처리됩니다.</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={doSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? '변경 중...' : '변경 확인'}
              </button>
              <button
                onClick={() => {
                  setShowChangeConfirm(false);
                  setSelectedUnit(currentPolicy?.okr_cycle_unit || 'year');
                }}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}