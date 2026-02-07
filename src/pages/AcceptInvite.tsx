// src/pages/AcceptInvite.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface InvitationData {
  company_name: string;
  email: string;
  full_name?: string;
  role_name?: string;
  invited_by_name?: string;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  
  // 회원가입 폼
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // 초대 정보 로딩
  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('../lib/supabase');

      console.log('Loading invitation with token:', token);

      // 초대 정보 조회
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .select(`
          email,
          full_name,
          status,
          expires_at,
          company_id,
          role_id,
          invited_by
        `)
        .eq('token', token)
        .single();

      console.log('Invitation data:', invitation);
      console.log('Invitation error:', inviteError);

      if (inviteError || !invitation) {
        console.error('Invitation not found:', inviteError);
        throw new Error('초대를 찾을 수 없습니다');
      }

      // 만료 확인
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('초대가 만료되었습니다');
      }

      // 이미 수락됨
      if (invitation.status === 'accepted') {
        throw new Error('이미 수락된 초대입니다');
      }

      // 회사 정보 가져오기
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', invitation.company_id)
        .single();

      // 역할 정보 가져오기
      let roleName = '';
      if (invitation.role_id) {
        const { data: role } = await supabase
          .from('roles')
          .select('display_name')
          .eq('id', invitation.role_id)
          .single();
        roleName = role?.display_name || '';
      }

      // 초대한 사람 정보
      let invitedByName = '';
      if (invitation.invited_by) {
        const { data: inviter } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', invitation.invited_by)
          .single();
        invitedByName = inviter?.full_name || '';
      }

      setInvitation({
        company_name: company?.name || '회사',
        email: invitation.email,
        full_name: invitation.full_name,
        role_name: roleName,
        invited_by_name: invitedByName
      });
      
      // 초대에 이름이 있으면 자동 입력
      if (invitation.full_name) {
        setFullName(invitation.full_name);
      }
    } catch (err) {
      console.error('Failed to load invitation:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !invitation) return;

    // 유효성 검사
    if (!fullName.trim()) {
      alert('이름을 입력해주세요');
      return;
    }

    if (password.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }

    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다');
      return;
    }

    try {
      setAccepting(true);
      const { supabase } = await import('../lib/supabase');

      // 1. 회원가입
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (signUpError) {
        // 이미 가입된 경우 → 로그인 시도
        if (signUpError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password: password
          });

          if (signInError) {
            throw new Error('이미 가입된 이메일입니다. 비밀번호를 확인하거나 비밀번호 재설정을 하세요.');
          }
        } else {
          throw signUpError;
        }
      }

      // 2. 잠시 대기 (Supabase Auth 처리 시간)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. 초대 수락
      const { data: acceptData, error: acceptError } = await supabase.rpc('accept_invitation', {
        invitation_token: token
      });

      if (acceptError) throw acceptError;

      if (!acceptData.success) {
        throw new Error(acceptData.error || '초대 수락에 실패했습니다');
      }

      // 4. 프로필 업데이트
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 역할 레벨 확인
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select(`
            role:roles(level)
          `)
          .eq('profile_id', user.id);

        const maxLevel = Math.max(...(userRoles?.map(r => r.role?.level || 0) || [0]));
        const isCompanyAdmin = maxLevel >= 90;

        await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: !isCompanyAdmin, // Company Admin은 false, 일반 팀원은 true
            full_name: fullName
          })
          .eq('id', user.id);

        // 5. 리다이렉트
        if (isCompanyAdmin) {
          // Company Admin → 온보딩
          alert('가입이 완료되었습니다! 조직 구조를 설정해주세요.');
          navigate('/onboarding');
        } else {
          // 일반 팀원 → 대시보드
          alert('가입 및 초대 수락이 완료되었습니다!');
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      alert('처리 중 오류가 발생했습니다: ' + (err as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">초대 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">초대가 유효하지 않습니다</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* 아이콘 */}
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
          초대를 받으셨습니다
        </h1>
        <p className="text-slate-600 text-center mb-8">
          {invitation.invited_by_name && (
            <span className="font-semibold">{invitation.invited_by_name}</span>
          )}
          {invitation.invited_by_name ? '님이 ' : ''}
          <span className="font-semibold">{invitation.company_name}</span>에 초대하셨습니다
        </p>

        {/* 초대 정보 */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">이메일</span>
            <span className="font-medium text-slate-900">{invitation.email}</span>
          </div>
          {invitation.role_name && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">역할</span>
              <span className="font-medium text-slate-900">{invitation.role_name}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">회사</span>
            <span className="font-medium text-slate-900">{invitation.company_name}</span>
          </div>
        </div>

        {/* 회원가입 폼 */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              이름
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              minLength={6}
            />
            <p className="text-xs text-slate-500 mt-1">최소 6자 이상</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              minLength={6}
            />
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 가입 후 자동으로 <strong>{invitation.company_name}</strong>의 구성원으로 등록됩니다
          </p>
        </div>

        {/* 버튼 */}
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {accepting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              가입하고 초대 수락
            </>
          )}
        </button>

        {/* 이미 계정이 있는 경우 */}
        <p className="text-center text-sm text-slate-600 mt-4">
          이미 계정이 있으신가요?{' '}
          <button
            onClick={() => navigate(`/login?invite=${token}`)}
            className="text-blue-600 font-medium hover:underline"
          >
            로그인
          </button>
        </p>
      </div>
    </div>
  );
}