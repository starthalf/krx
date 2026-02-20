// src/pages/PeriodCloseWizard.tsx
// 기간 마감 위자드 - Step by Step으로 마감 프로세스 진행

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft,
  Calendar, Building2, Target, TrendingUp, Archive,
  Loader2, X, AlertOctagon, Info, Lock, Unlock,
  BarChart3, Users, FileCheck, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchFiscalPeriod,
  fetchIncompleteItems,
  startClosing,
  closePeriod,
  forceClosePeriod,
  createPeriodSnapshot,
  archivePeriod,
  cancelClosing,
} from '../lib/period-api';
import {
  FiscalPeriod,
  PeriodIncompleteDetails,
  PERIOD_STATUS_CONFIG,
} from '../types/period.types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type WizardStep = 'review' | 'incomplete' | 'confirm' | 'processing' | 'complete';

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { id: 'review', title: '마감 대상 확인', description: '기간 정보와 현황을 확인합니다' },
  { id: 'incomplete', title: '미완료 항목 검토', description: '미완료 항목을 확인하고 처리 방법을 선택합니다' },
  { id: 'confirm', title: '최종 확인', description: '마감 전 최종 확인을 진행합니다' },
  { id: 'processing', title: '마감 처리', description: '마감 및 스냅샷 생성 중...' },
  { id: 'complete', title: '완료', description: '마감이 완료되었습니다' },
];

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function PeriodCloseWizard() {
  const navigate = useNavigate();
  const { periodId } = useParams<{ periodId: string }>();
  const { user, profile } = useAuth();
  const companyId = profile?.company_id;

  // State
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FiscalPeriod | null>(null);
  const [currentStep, setCurrentStep] = useState<WizardStep>('review');
  const [incompleteDetails, setIncompleteDetails] = useState<PeriodIncompleteDetails | null>(null);
  
  // 강제 마감 관련
  const [forceClose, setForceClose] = useState(false);
  const [forceCloseReason, setForceCloseReason] = useState('');
  const [forceCloseConfirmed, setForceCloseConfirmed] = useState(false);
  
  // 처리 상태
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    snapshotCount?: number;
    forceClosed?: boolean;
  } | null>(null);

  // ─────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────
  const loadPeriod = useCallback(async () => {
    if (!periodId) return;
    
    setLoading(true);
    try {
      const data = await fetchFiscalPeriod(periodId);
      setPeriod(data);
      
      if (data?.status === 'closing') {
        setCurrentStep('incomplete');
        const incomplete = await fetchIncompleteItems(periodId);
        setIncompleteDetails(incomplete);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    loadPeriod();
  }, [loadPeriod]);

  // ─────────────────────────────────────────────────────────
  // Step Handlers
  // ─────────────────────────────────────────────────────────
  
  const handleStartClosing = async () => {
    if (!periodId || !user?.id) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await startClosing(periodId, user.id);
      if (!result.success) {
        throw new Error(result.error || '마감 시작 실패');
      }
      
      const incomplete = await fetchIncompleteItems(periodId);
      setIncompleteDetails(incomplete);
      
      const updatedPeriod = await fetchFiscalPeriod(periodId);
      setPeriod(updatedPeriod);
      
      setCurrentStep('incomplete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToConfirm = () => {
    const hasIncomplete = incompleteDetails && (
      incompleteDetails.unapprovedOkrSets.length > 0 ||
      incompleteDetails.krsWithoutCheckin.length > 0 ||
      incompleteDetails.zeroAchievementOrgs.length > 0
    );
    
    if (hasIncomplete && !forceClose) {
      setError('미완료 항목이 있습니다. 강제 마감을 선택하거나 항목을 완료해주세요.');
      return;
    }
    
    if (forceClose && !forceCloseReason.trim()) {
      setError('강제 마감 사유를 입력해주세요.');
      return;
    }
    
    setError(null);
    setCurrentStep('confirm');
  };

  const handleExecuteClose = async () => {
    if (!periodId || !user?.id) return;
    
    if (!forceCloseConfirmed && forceClose) {
      setError('강제 마감 확인 체크박스를 선택해주세요.');
      return;
    }
    
    setCurrentStep('processing');
    setIsProcessing(true);
    setError(null);
    
    try {
      setProcessStatus('기간 마감 처리 중...');
      
      let closeResult;
      if (forceClose) {
        closeResult = await forceClosePeriod(periodId, user.id, forceCloseReason);
      } else {
        closeResult = await closePeriod(periodId, user.id);
      }
      
      if (!closeResult.success) {
        throw new Error(closeResult.error || '마감 처리 실패');
      }
      
      setProcessStatus('성과 스냅샷 생성 중...');
      const snapshotResult = await createPeriodSnapshot(periodId, user.id);
      
      if (!snapshotResult.success) {
        console.warn('스냅샷 생성 경고:', snapshotResult.error);
      }
      
      setResult({
        success: true,
        snapshotCount: snapshotResult.snapshotCount,
        forceClosed: forceClose,
      });
      
      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message);
      setCurrentStep('confirm');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleCancelClosing = async () => {
    if (!periodId || !user?.id) return;
    
    if (!confirm('마감을 취소하고 다시 활성 상태로 되돌리시겠습니까?')) return;
    
    setIsProcessing(true);
    try {
      const result = await cancelClosing(periodId, user.id);
      if (!result.success) {
        throw new Error(result.error || '마감 취소 실패');
      }
      navigate('/admin?tab=periods');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Render Helpers
  // ─────────────────────────────────────────────────────────
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  
  const hasIncompleteItems = incompleteDetails && (
    incompleteDetails.unapprovedOkrSets.length > 0 ||
    incompleteDetails.krsWithoutCheckin.length > 0 ||
    incompleteDetails.zeroAchievementOrgs.length > 0
  );

  // ─────────────────────────────────────────────────────────
  // Loading State
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>기간 정보 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertOctagon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">기간을 찾을 수 없습니다</h2>
          <button
            onClick={() => navigate('/admin?tab=periods')}
            className="text-blue-600 hover:text-blue-700"
          >
            기간 관리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin?tab=periods')}
            className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            기간 관리로 돌아가기
          </button>
          <h1 className="text-2xl font-bold text-slate-900">기간 마감 위자드</h1>
          <p className="text-slate-600 mt-1">
            {period.periodName} ({period.periodCode}) 마감을 진행합니다
          </p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            {STEPS.filter(s => s.id !== 'processing').map((step, idx) => {
              const stepIndex = STEPS.findIndex(s => s.id === step.id);
              const isCompleted = currentStepIndex > stepIndex;
              const isCurrent = currentStep === step.id || 
                (currentStep === 'processing' && step.id === 'confirm');
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-100 text-green-600' :
                      isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-semibold">{idx + 1}</span>
                      )}
                    </div>
                    <span className={`text-xs mt-2 ${
                      isCurrent ? 'font-medium text-blue-600' : 'text-slate-400'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                  {idx < STEPS.filter(s => s.id !== 'processing').length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 mb-6 ${
                      isCompleted ? 'bg-green-300' : 'bg-slate-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">오류가 발생했습니다</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* ─── Step 1: Review ─── */}
          {currentStep === 'review' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                마감 대상 기간 확인
              </h2>
              
              <div className="bg-slate-50 rounded-lg p-5 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">기간 코드</p>
                    <p className="font-semibold text-slate-900">{period.periodCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">기간명</p>
                    <p className="font-semibold text-slate-900">{period.periodName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">기간</p>
                    <p className="font-medium text-slate-700">
                      {new Date(period.startsAt).toLocaleDateString('ko-KR')} ~{' '}
                      {new Date(period.endsAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">현재 상태</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      PERIOD_STATUS_CONFIG[period.status].bgColor
                    } ${PERIOD_STATUS_CONFIG[period.status].color}`}>
                      {PERIOD_STATUS_CONFIG[period.status].label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">마감 프로세스 안내</p>
                    <ul className="space-y-1 text-blue-700">
                      <li>• 마감 시작 후 미완료 항목을 확인합니다</li>
                      <li>• 모든 항목이 완료되면 정상 마감이 진행됩니다</li>
                      <li>• 미완료 항목이 있어도 <strong>강제 마감</strong>이 가능합니다</li>
                      <li>• 마감 완료 시 성과 스냅샷이 자동 생성됩니다</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => navigate('/admin?tab=periods')}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleStartClosing}
                  disabled={isProcessing || period.status !== 'active'}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  마감 시작
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Incomplete Items ─── */}
          {currentStep === 'incomplete' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                미완료 항목 검토
              </h2>

              {!hasIncompleteItems ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-green-800 font-medium">모든 항목이 완료되었습니다!</p>
                  <p className="text-green-600 text-sm mt-1">정상적으로 마감을 진행할 수 있습니다.</p>
                </div>
              ) : (
                <>
                  {/* 미승인 OKR Sets */}
                  {incompleteDetails?.unapprovedOkrSets && incompleteDetails.unapprovedOkrSets.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-amber-500" />
                        미승인 OKR ({incompleteDetails.unapprovedOkrSets.length}개 조직)
                      </h3>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-amber-100">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-amber-800">조직</th>
                              <th className="text-left px-4 py-2 font-medium text-amber-800">레벨</th>
                              <th className="text-left px-4 py-2 font-medium text-amber-800">상태</th>
                              <th className="text-center px-4 py-2 font-medium text-amber-800">목표 수</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incompleteDetails.unapprovedOkrSets.slice(0, 5).map((item, idx) => (
                              <tr key={idx} className="border-t border-amber-200">
                                <td className="px-4 py-2 text-slate-700">{item.org_name}</td>
                                <td className="px-4 py-2 text-slate-600">{item.org_level}</td>
                                <td className="px-4 py-2">
                                  <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs">
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-center text-slate-600">{item.objective_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {incompleteDetails.unapprovedOkrSets.length > 5 && (
                          <div className="px-4 py-2 text-center text-xs text-amber-700 border-t border-amber-200">
                            외 {incompleteDetails.unapprovedOkrSets.length - 5}개 조직...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 체크인 없는 KRs */}
                  {incompleteDetails?.krsWithoutCheckin && incompleteDetails.krsWithoutCheckin.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-red-500" />
                        실적 미입력 KR ({incompleteDetails.krsWithoutCheckin.length}개)
                      </h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-red-100">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-red-800">조직</th>
                              <th className="text-left px-4 py-2 font-medium text-red-800">KR</th>
                              <th className="text-right px-4 py-2 font-medium text-red-800">현재값/목표</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incompleteDetails.krsWithoutCheckin.slice(0, 5).map((item, idx) => (
                              <tr key={idx} className="border-t border-red-200">
                                <td className="px-4 py-2 text-slate-700">{item.org_name}</td>
                                <td className="px-4 py-2 text-slate-600">{item.kr_name}</td>
                                <td className="px-4 py-2 text-right text-red-600">
                                  {item.current_value} / {item.target_value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {incompleteDetails.krsWithoutCheckin.length > 5 && (
                          <div className="px-4 py-2 text-center text-xs text-red-700 border-t border-red-200">
                            외 {incompleteDetails.krsWithoutCheckin.length - 5}개 KR...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 강제 마감 옵션 */}
                  <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 mt-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceClose}
                        onChange={(e) => setForceClose(e.target.checked)}
                        className="mt-1 w-5 h-5 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                      <div>
                        <span className="font-medium text-slate-900 flex items-center gap-2">
                          <AlertOctagon className="w-4 h-4 text-red-500" />
                          강제 마감 진행
                        </span>
                        <p className="text-sm text-slate-600 mt-1">
                          미완료 항목이 있어도 현재 상태 그대로 마감을 진행합니다.<br />
                          미입력 실적은 0%로 처리됩니다.
                        </p>
                      </div>
                    </label>
                    
                    {forceClose && (
                      <div className="mt-4 ml-8">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          강제 마감 사유 (필수)
                        </label>
                        <textarea
                          value={forceCloseReason}
                          onChange={(e) => setForceCloseReason(e.target.value)}
                          placeholder="강제 마감 사유를 입력하세요..."
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={handleCancelClosing}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Unlock className="w-4 h-4" />
                  마감 취소
                </button>
                <button
                  onClick={handleProceedToConfirm}
                  disabled={isProcessing || (hasIncompleteItems && !forceClose)}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음 단계
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Confirm ─── */}
          {currentStep === 'confirm' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                최종 확인
              </h2>

              <div className="space-y-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">마감 요약</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">기간:</span>
                      <span className="ml-2 font-medium text-slate-900">{period.periodName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">기간 코드:</span>
                      <span className="ml-2 font-medium text-slate-900">{period.periodCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">마감 유형:</span>
                      <span className={`ml-2 font-medium ${forceClose ? 'text-red-600' : 'text-green-600'}`}>
                        {forceClose ? '⚠️ 강제 마감' : '✓ 정상 마감'}
                      </span>
                    </div>
                    {forceClose && (
                      <div className="col-span-2">
                        <span className="text-slate-500">강제 마감 사유:</span>
                        <span className="ml-2 text-slate-700">{forceCloseReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">마감 시 처리 내용</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 기간 상태가 'closed'로 변경됩니다</li>
                    <li>• 모든 조직의 성과 스냅샷이 생성됩니다</li>
                    <li>• 달성률과 등급이 최종 확정됩니다</li>
                    <li>• 마감 후 OKR 데이터는 수정할 수 없습니다</li>
                  </ul>
                </div>

                {forceClose && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-800 font-medium">강제 마감 경고</p>
                        <p className="text-red-700 text-sm mt-1">
                          미완료 항목이 있는 상태로 마감됩니다. 이 작업은 되돌릴 수 없습니다.
                        </p>
                        <label className="flex items-center gap-2 mt-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={forceCloseConfirmed}
                            onChange={(e) => setForceCloseConfirmed(e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500"
                          />
                          <span className="text-sm text-red-800 font-medium">
                            위 내용을 이해했으며 강제 마감을 진행합니다
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep('incomplete')}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  이전 단계
                </button>
                <button
                  onClick={handleExecuteClose}
                  disabled={isProcessing || (forceClose && !forceCloseConfirmed)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    forceClose 
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                  {forceClose ? '강제 마감 실행' : '마감 실행'}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 4: Processing ─── */}
          {currentStep === 'processing' && (
            <div className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">마감 처리 중...</h2>
              <p className="text-slate-600">{processStatus || '잠시만 기다려주세요'}</p>
            </div>
          )}

          {/* ─── Step 5: Complete ─── */}
          {currentStep === 'complete' && result && (
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                result.forceClosed ? 'bg-amber-100' : 'bg-green-100'
              }`}>
                <CheckCircle2 className={`w-8 h-8 ${
                  result.forceClosed ? 'text-amber-600' : 'text-green-600'
                }`} />
              </div>
              
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                {result.forceClosed ? '강제 마감 완료' : '마감 완료'}
              </h2>
              
              <p className="text-slate-600 mb-6">
                {period.periodName} 기간이 성공적으로 마감되었습니다.
                {result.snapshotCount && (
                  <span className="block mt-1">
                    {result.snapshotCount}개 조직의 성과 스냅샷이 생성되었습니다.
                  </span>
                )}
              </p>

              {result.forceClosed && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-amber-800 font-medium">강제 마감 정보</p>
                      <p className="text-amber-700 mt-1">사유: {forceCloseReason}</p>
                      <p className="text-amber-600 mt-1">
                        미완료 항목은 현재 상태 그대로 기록되었습니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate('/admin?tab=periods')}
                  className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  기간 관리로 돌아가기
                </button>
                <button
                  onClick={() => navigate(`/period-history/${periodId}`)}
                  className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  성과 요약 보기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}