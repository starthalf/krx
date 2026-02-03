// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Target } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 로딩 중일 때 스피너 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl">
          <Target className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>로딩 중...</span>
        </div>
      </div>
    );
  }

  // 로그인 안 되어 있으면 로그인 페이지로
  if (!user) {
    // 현재 위치를 state로 전달 (로그인 후 원래 페이지로 돌아가기 위해)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 로그인 되어 있으면 children 렌더링
  return <>{children}</>;
}