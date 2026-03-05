// src/pages/AcceptInvite.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, Loader2, Crown, User, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface InvitationData {
  company_id: string;
  company_name: string;
  email: string;
  full_name?: string;
  role_id?: string;
  role_name?: string;
  org_id?: string;
  org_name?: string;
  invited_by_name?: string;
}

interface Organization {
  id: string;
  name: string;
  level: string;
}

// profiles 테이블에 row가 생길 때까지 polling
const waitForProfile = async (userId: string, maxRetries = 10): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (data) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
};

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshProfile, setSkipAutoProfile } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedRoleType, setSelectedRoleType] = useState<'org_head' | 'team_member' | ''>('');

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);

      const { data: invitationData, error: inviteError } = await supabase
        .from('invitations')
        .select(`
          email,
          full_name,
          status,
          expires_at,
          company_id,
          role_id,
          org_id,
          invited_by
        `)
        .eq('token', token)
        .single();

      if (inviteError || !invitationData) {
        throw new Error('초대를 찾을 수 없습니다');
      }

      if (new Date(invitationData.expires_at) < new Date()) {
        throw new Error('초대가 만료되었습니다');
      }

      if (invitationData.status === 'accepted') {
        throw new Error('이미 수락된 초대입니다');
      }

      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', invitationData.company_id)
        .single();

      let roleName = '';
      if (invitationData.role_id) {
        const { data: role } = await supabase
          .from('roles')
          .select('display_name')
          .eq('id', invitationData.role_id)
          .single();
        roleName = role?.display_name || '';
      }

      let orgName = '';
      if (invitationData.org_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', invitationData.org_id)
          .single();
        orgName = org?.name || '';
      }

      let invitedByName = '';
      if (invitationData.invited_by) {
        const { data: inviter } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', invitationData.invited_by)
          .single();
        invitedByName = inviter?.full_name || '';
      }

      setInvitation({
        company_id: invitationData.company_id,
        company_name: company?.name || '회사',
        email: invitationData.email,
        full_name: invitationData.full_name,
        role_id: invitationData.role_id,
        role_name: roleName,
        org_id: invitationData.org_id,
        org_name: orgName,
        invited_by_name: invitedByName
      });
      
      if (invitationData.full_name) {
        setFullName(invitationData.full_name);
      }

      if (!invitationData.org_id || !invitationData.role_id) {
        await loadOrganizations(invitationData.company_id);
      }

    } catch (err) {
      console.error('Failed to load invitation:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async (companyId: string) => {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, level')
      .eq('company_id', companyId)
      .order('name');

    setOrganizations(orgs || []);
  };

const needsOrgRoleSelection = !invitation?.role_id && !invitation?.org_id;

  const handleAccept = async () => {
    if (!token || !invitation) return;

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

if (needsOrgRoleSelection) {
  if (!selectedOrgId) {
    alert('소속 조직을 선택해주세요');
    return;
  }
  if (!selectedRoleType) {
    alert('역할을 선택해주세요');
    return;
  }
}

    try {
      setAccepting(true);

      // ★ AuthContext의 자동 프로필 조회 억제
      if (setSkipAutoProfile) {
        setSkipAutoProfile(true);
      }

      // ── 1. 회원가입 또는 로그인 ──
      let userId: string | null = null;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: { 
            full_name: fullName,
            company_id: invitation.company_id,
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password: password
          });
          if (signInError) {
            throw new Error('이미 가입된 이메일입니다. 비밀번호를 확인해주세요.');
          }
          userId = signInData.user?.id || null;
        } else {
          throw signUpError;
        }
      } else {
        userId = signUpData.user?.id || null;
      }

      if (!userId) {
        throw new Error('사용자 계정 생성에 실패했습니다');
      }

      // ── ★ 2. 초대 상태를 즉시 accepted로 업데이트 ──
      //    (이후 프로필/역할 생성에서 에러가 나도 초대는 수락 처리됨)
      console.log('✅ 초대 상태 accepted로 업데이트');
      await supabase
        .from('invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('token', token);

      // ── 3. profiles 테이블에 row 생성 대기 ──
      console.log('⏳ Waiting for profile to be created...', userId);
      const profileExists = await waitForProfile(userId);
      
      if (!profileExists) {
        console.log('⚠️ Profile not auto-created, creating manually...');
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            full_name: fullName,
            company_id: invitation.company_id,
          }, { onConflict: 'id' });
        
        if (profileError) {
          console.error('Profile creation failed:', profileError);
          throw new Error('프로필 생성에 실패했습니다: ' + profileError.message);
        }
      } else {
        await supabase
          .from('profiles')
          .update({ 
            company_id: invitation.company_id,
            full_name: fullName
          })
          .eq('id', userId);
      }

      // ── 4. user_roles 할당 ──
      const orgId = invitation.org_id || selectedOrgId;
      let roleId = invitation.role_id;

      if (!roleId) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('name', selectedRoleType || 'team_member')
          .single();
        roleId = roleData?.id;
      }

      if (roleId) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('profile_id', userId)
          .eq('org_id', orgId)
          .maybeSingle();

        if (!existingRole) {
          const { error: roleInsertError } = await supabase
            .from('user_roles')
            .insert({
              profile_id: userId,
              org_id: orgId,
              role_id: roleId,
              granted_by: userId,
            });

          if (roleInsertError) {
            console.error('user_roles insert failed:', roleInsertError);
            throw new Error('역할 할당에 실패했습니다: ' + roleInsertError.message);
          }
        }
      }

      // ── 5. onboarding 상태 설정 ──
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles!inner(level)')
        .eq('profile_id', userId);

      const maxLevel = Math.max(...(userRoles?.map((r: any) => r.roles?.level || 0) || [0]));
      const isCompanyAdmin = maxLevel >= 90;

      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: !isCompanyAdmin,
          full_name: fullName
        })
        .eq('id', userId);

      // ── 6. ★ AuthContext 프로필 갱신 후 리다이렉트 ──
      if (setSkipAutoProfile) {
        setSkipAutoProfile(false);
      }
      if (refreshProfile) {
        await refreshProfile();
      }

      if (isCompanyAdmin) {
        alert('가입이 완료되었습니다! 조직 구조를 설정해주세요.');
        navigate('/onboarding');
      } else {
        alert('가입 및 초대 수락이 완료되었습니다!');
        navigate('/dashboard');
      }

    } catch (err) {
      console.error('Failed to accept invitation:', err);
      if (setSkipAutoProfile) {
        setSkipAutoProfile(false);
      }
      alert('처리 중 오류가 발생했습니다: ' + (err as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  const groupedOrgs = organizations.reduce((acc, org) => {
    const level = org.level || '기타';
    if (!acc[level]) acc[level] = [];
    acc[level].push(org);
    return acc;
  }, {} as Record<string, Organization[]>);

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
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>

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

        <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">이메일</span>
            <span className="font-medium text-slate-900">{invitation.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">회사</span>
            <span className="font-medium text-slate-900">{invitation.company_name}</span>
          </div>
          {invitation.org_name && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">소속 조직</span>
              <span className="font-medium text-slate-900">{invitation.org_name}</span>
            </div>
          )}
          {invitation.role_name && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">역할</span>
              <span className="font-medium text-slate-900">{invitation.role_name}</span>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">이름 *</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">비밀번호 *</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">비밀번호 확인 *</label>
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

        {needsOrgRoleSelection && (
          <div className="space-y-4 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800 mb-2">
              <Building2 className="w-5 h-5" />
              <span className="font-semibold text-sm">소속 정보를 선택해주세요</span>
            </div>

            {!invitation.org_id && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">소속 조직 *</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">조직을 선택하세요</option>
                  {Object.entries(groupedOrgs).map(([level, orgs]) => (
                    <optgroup key={level} label={`━━ ${level} ━━`}>
                      {orgs.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {!invitation.role_id && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">역할 *</label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRoleType('org_head')}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedRoleType === 'org_head'
                        ? 'border-amber-500 bg-amber-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Crown className={`w-5 h-5 ${selectedRoleType === 'org_head' ? 'text-amber-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-medium text-slate-900">조직장</div>
                        <div className="text-xs text-slate-500">조직 OKR 관리, 하위 승인/독촉</div>
                      </div>
                      {selectedRoleType === 'org_head' && (
                        <CheckCircle className="w-5 h-5 text-amber-600 ml-auto" />
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRoleType('team_member')}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedRoleType === 'team_member'
                        ? 'border-blue-500 bg-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User className={`w-5 h-5 ${selectedRoleType === 'team_member' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-medium text-slate-900">구성원</div>
                        <div className="text-xs text-slate-500">개인 OKR 수립, 체크인</div>
                      </div>
                      {selectedRoleType === 'team_member' && (
                        <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                      )}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 가입 후 자동으로 <strong>{invitation.company_name}</strong>의 구성원으로 등록됩니다
          </p>
        </div>

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