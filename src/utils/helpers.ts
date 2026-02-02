import type { DynamicKR, GradeType, BIIType } from '../types';

export function calculateGrade(kr: DynamicKR): GradeType {
  const value = kr.currentValue;
  const criteria = kr.gradeCriteria;

  if (kr.unit === '일' || kr.indicatorType === '투입') {
    if (value <= criteria.S) return 'S';
    if (value <= criteria.A) return 'A';
    if (value <= criteria.B) return 'B';
    if (value <= criteria.C) return 'C';
    return 'D';
  }

  if (value >= criteria.S) return 'S';
  if (value >= criteria.A) return 'A';
  if (value >= criteria.B) return 'B';
  if (value >= criteria.C) return 'C';
  return 'D';
}

export function getGradeColor(grade: GradeType): string {
  const colors = {
    S: 'bg-blue-600 text-white',
    A: 'bg-emerald-600 text-white',
    B: 'bg-lime-600 text-white',
    C: 'bg-orange-500 text-white',
    D: 'bg-red-600 text-white'
  };
  return colors[grade];
}

export function getBIIColor(biiType: BIIType): { bg: string; text: string; badge: string } {
  const colors = {
    Build: { bg: 'bg-violet-100', text: 'text-violet-700', badge: 'bg-violet-600' },
    Innovate: { bg: 'bg-blue-100', text: 'text-blue-700', badge: 'bg-blue-600' },
    Improve: { bg: 'bg-green-100', text: 'text-green-700', badge: 'bg-green-600' }
  };
  return colors[biiType];
}

export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

export function calculateProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.round((current / target) * 100);
}

export function getOrgTypeColor(type: 'Front' | 'Middle' | 'Back'): string {
  const colors = {
    Front: 'bg-blue-100 text-blue-700 border-blue-200',
    Middle: 'bg-gray-100 text-gray-700 border-gray-200',
    Back: 'bg-green-100 text-green-700 border-green-200'
  };
  return colors[type];
}

export function getKPICategoryColor(category: '전략' | '고유업무' | '공통'): string {
  const colors = {
    전략: 'bg-purple-100 text-purple-700 border-purple-200',
    고유업무: 'bg-blue-100 text-blue-700 border-blue-200',
    공통: 'bg-gray-100 text-gray-700 border-gray-200'
  };
  return colors[category];
}

export function getMilestoneProgress(kr: DynamicKR): number {
  if (!kr.milestones || kr.milestones.length === 0) return 0;
  const completed = kr.milestones.filter(m => m.completed).length;
  return Math.round((completed / kr.milestones.length) * 100);
}
