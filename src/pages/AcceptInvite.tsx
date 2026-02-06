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

      if (inviteError || !invitation) {
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
    } catch (err) {
      console.error('Failed to load invitation:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;

    try {
      setAccepting(true);
      const { supabase } = await import('../lib/supabase');

      // 현재 로그인 상태 확인
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // 로그인 안 되어 있으면 로그인 페이지로 (token 유지)
        navigate(`/login?invite=${token}`);
        return;
      }

      // 이메일 확인
      if (user.email !== invitation?.email) {
        alert(`이 초대는 ${invitation?.email}로 발송되었습니다.\n해당 이메일로 로그인해주세요.`);
        await supabase.auth.signOut();
        navigate(`/login?invite=${token}`);
        return;
      }

      // 초대 수락 처리
      const { data, error } = await supabase.rpc('accept_invitation', {
        invitation_token: token
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || '초대 수락에 실패했습니다');
      }

      // 초대받은 사용자는 온보딩 스킵 (이미 회사가 설정되어 있으므로)
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      // 바로 대시보드로
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      alert('초대 수락 중 오류가 발생했습니다: ' + (err as Error).message);
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
        <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">이메일</span>
            <span className="font-medium text-slate-900">{invitation.email}</span>
          </div>
          {invitation.full_name && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">이름</span>
              <span className="font-medium text-slate-900">{invitation.full_name}</span>
            </div>
          )}
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

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 초대를 수락하면 <strong>{invitation.company_name}</strong>의 팀원으로 등록되며,
            OKR 시스템을 사용할 수 있습니다.
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
              초대 수락
            </>
          )}
        </button>

        {/* 거절 */}
        <button
          onClick={() => navigate('/login')}
          className="w-full mt-3 px-6 py-3 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-sm"
        >
          나중에 하기
        </button>
      </div>
    </div>
  );
}