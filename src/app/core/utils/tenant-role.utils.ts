/**
 * Heurísticas alineadas con códigos de rol del backend (p. ej. TenantOwner, Admin, Editor).
 */

export function isTenantOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase().replace(/[\s_-]/g, '');
  return r === 'tenantowner' || r === 'owner' || r.endsWith('owner');
}

/**
 * Editor de contenido / miembro con rol Editor en el tenant (no gestiona equipo).
 */
export function isTenantEditorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (r === 'editor' || r === 'tenanteditor') {
    return true;
  }
  // Códigos tipo "ContentEditor"; evitar falsos positivos con "Administrator"
  if (r.endsWith('editor') && !r.includes('administrator') && !r.endsWith('admin')) {
    return true;
  }
  return false;
}

/** Administrador de tenant (no propietario). */
export function isTenantAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  if (isTenantOwnerRole(role)) return false;
  if (isTenantEditorRole(role)) return false;
  const r = role.trim().toLowerCase().replace(/[\s_-]/g, '');
  return r === 'admin' || r === 'tenantadmin' || r.includes('admin');
}

export function isWorkspaceManagerRole(role: string | null | undefined): boolean {
  return isTenantOwnerRole(role) || isTenantAdminRole(role);
}
