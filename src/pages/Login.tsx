// src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Target, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 초대 토큰이 있으면 안내 메시지 표시
  const inviteToken = searchParams.get('invite');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isSignUp) {
        // 회원가입 - 초대 기반만 허용
        if (!fullName.trim()) {
          setError('이름을 입력해주세요.');
          setLoading(false);
          return;
        }

        // 초대 기반 시스템 안내
        setError('⚠️ OKRio는 초대를 통해서만 가입할 수 있습니다.\n\n관리자에게 초대 링크를 요청하세요.');
        setLoading(false);
        return;
      } else {
        // 로그인
        const { error: signInError } = await signIn(email, password);
        
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
          } else {
            setError(signInError.message);
          }
        } else {
          // 초대 토큰이 있으면 초대 수락 페이지로
          if (inviteToken) {
            navigate(`/accept-invite/${inviteToken}`);
          } else {
            navigate('/');
          }
        }
      }
    } catch (err) {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 데모 계정으로 빠른 로그인
  const handleDemoLogin = async () => {
    setEmail('demo@okrio.kr');
    setPassword('demo1234');
    setLoading(true);
    setError(null);

    // 데모 계정이 없으면 생성 시도
    const { error: signInError } = await signIn('demo@okrio.kr', 'demo1234');
    
    if (signInError) {
      // 로그인 실패하면 회원가입 시도
      const { error: signUpError } = await signUp('demo@okrio.kr', 'demo1234', '데모 사용자');
      
      if (signUpError && !signUpError.message.includes('already registered')) {
        setError('데모 계정 생성 실패: ' + signUpError.message);
        setLoading(false);
        return;
      }

      // 다시 로그인 시도
      const { error: retryError } = await signIn('demo@okrio.kr', 'demo1234');
      if (retryError) {
        setError('데모 로그인 실패. 이메일 인증이 필요할 수 있습니다.');
        setLoading(false);
        return;
      }
    }

    navigate('/');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 & 타이틀 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">OKRio</h1>
          <p className="text-slate-600 mt-2">AI 기반 OKR 목표 관리 시스템</p>
        </div>

        {/* 초대 링크로 온 경우 안내 */}
        {inviteToken && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💌 초대를 받으셨습니다!</strong><br />
              로그인하여 초대를 수락하세요.
            </p>
          </div>
        )}

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            {isSignUp ? '회원가입' : '로그인'}
          </h2>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="whitespace-pre-line">{error}</div>
            </div>
          )}

          {/* 성공 메시지 */}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 (회원가입 시에만) */}
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  이름
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                  minLength={6}
                />
              </div>
              {isSignUp && (
                <p className="text-xs text-slate-500 mt-1">최소 6자 이상</p>
              )}
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  처리 중...
                </>
              ) : (
                isSignUp ? '가입하기' : '로그인'
              )}
            </button>
          </form>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">또는</span>
            </div>
          </div>

          {/* 데모 로그인 버튼 */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 transition-all"
          >
            🚀 데모 계정으로 바로 시작
          </button>

          {/* 회원가입/로그인 전환 */}
          <p className="text-center text-sm text-slate-600 mt-6">
            {isSignUp ? (
              <>
                이미 계정이 있으신가요?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-blue-600 font-medium hover:underline"
                >
                  로그인
                </button>
              </>
            ) : (
              <>
                초대를 받으셨나요?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError('초대 링크를 통해 가입해주세요.\n\n관리자에게 초대 링크를 요청하세요.');
                  }}
                  className="text-blue-600 font-medium hover:underline"
                >
                  회원가입 안내
                </button>
              </>
            )}
          </p>
        </div>

        {/* 하단 정보 */}
        <p className="text-center text-xs text-slate-500 mt-6">
          © 2025 OKRio. AI가 80% 해주고, 사용자는 확인만.
        </p>
      </div>
    </div>
  );
}