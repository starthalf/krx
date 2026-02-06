// src/components/admin/RolePermissionsManager.tsx
import { useEffect, useState } from 'react';
import { 
  getAllRoles, getAllPermissions, getRolePermissions, updateRolePermissions,
  Role, Permission
} from '../../lib/permissions';
import { Shield, Check, Save, AlertTriangle } from 'lucide-react';

export default function RolePermissionsManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await getAllRoles();
        setRoles(data);
        if (data.length > 0 && !selectedRole) setSelectedRole(data[0]);
      } catch (error) {
        console.error('Failed to load roles:', error);
      }
    };
    loadRoles();
  }, []);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const data = await getAllPermissions();
        setPermissions(data);
      } catch (error) {
        console.error('Failed to load permissions:', error);
      }
    };
    loadPermissions();
  }, []);

  useEffect(() => {
    const loadRolePermissions = async () => {
      if (!selectedRole) return;
      try {
        setLoading(true);
        const rolePerms = await getRolePermissions(selectedRole.id);
        setSelectedPermissions(rolePerms.map(rp => rp.permission_id));
      } catch (error) {
        console.error('Failed to load role permissions:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRolePermissions();
  }, [selectedRole]);

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    try {
      setLoading(true);
      await updateRolePermissions(selectedRole.id, selectedPermissions);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save permissions:', error);
      alert('저장에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (level: number) => {
    if (level >= 100) return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' };
    if (level >= 90) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    if (level >= 70) return { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' };
    if (level >= 50) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
    if (level >= 30) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' };
    return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">역할 선택</h3>
          <p className="text-sm text-slate-600">권한을 설정할 역할을 선택하세요</p>
        </div>
        <div className="space-y-2">
          {roles.map((role) => {
            const colors = getRoleColor(role.level);
            return (
              <button key={role.id} onClick={() => setSelectedRole(role)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRole?.id === role.id ? `${colors.border} ${colors.bg}` : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                <div className={`p-2 ${colors.bg} rounded-lg`}>
                  <Shield className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{role.display_name}</div>
                  <div className="text-xs text-slate-500">레벨 {role.level}</div>
                </div>
                {selectedRole?.id === role.id && <Check className="w-5 h-5 text-blue-600" />}
              </button>
            );
          })}
        </div>
        {selectedRole?.is_system && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-800"><strong>시스템 역할</strong>입니다. 수정 시 주의하세요.</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {selectedRole ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedRole.display_name} 권한 설정</h3>
                <p className="text-sm text-slate-600">{selectedPermissions.length}개 권한 선택됨</p>
              </div>
              <button onClick={handleSave} disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2">
                <Save className="w-4 h-4" />저장
              </button>
            </div>

            {saveSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                <Check className="w-5 h-5" /><span className="text-sm font-medium">성공적으로 저장되었습니다!</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(permissions).map(([category, perms]) => (
                  <div key={category} className="bg-white rounded-lg border border-slate-200 p-4">
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      {category} ({perms.length}개)
                    </h4>
                    <div className="space-y-2">
                      {perms.map((perm) => {
                        const isChecked = selectedPermissions.includes(perm.id);
                        return (
                          <label key={perm.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              isChecked ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                            }`}>
                            <input type="checkbox" checked={isChecked}
                              onChange={() => handleTogglePermission(perm.id)}
                              className="w-4 h-4 text-blue-600 rounded" />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-900">{perm.name}</div>
                              {perm.description && <div className="text-xs text-slate-500 mt-1">{perm.description}</div>}
                              <div className="text-xs text-slate-400 mt-1 font-mono">{perm.code}</div>
                            </div>
                            {isChecked && <Check className="w-5 h-5 text-blue-600" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-lg border border-slate-200">
            <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">왼쪽에서 역할을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}