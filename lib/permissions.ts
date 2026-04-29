import "server-only";

import type { Profile } from "@/lib/types";

type Role = Profile["role"] | string | null | undefined;
type ProfileLike = Pick<Profile, "role" | "is_active"> | null | undefined;

function roleOf(profileOrRole: ProfileLike | Role) {
  if (typeof profileOrRole === "string" || profileOrRole == null) {
    return profileOrRole ?? null;
  }

  return profileOrRole.role;
}

function isActive(profileOrRole: ProfileLike | Role) {
  if (typeof profileOrRole === "string" || profileOrRole == null) {
    return true;
  }

  return profileOrRole.is_active !== false;
}

export function isLegacyAdmin(role?: Role) {
  return role === "admin";
}

export function isAdminLike(profileOrRole: ProfileLike | Role) {
  const role = roleOf(profileOrRole);
  return isActive(profileOrRole) && (role === "super_admin" || role === "admin_kais" || role === "admin");
}

export function canAccessDashboard(profile: ProfileLike) {
  return Boolean(profile && profile.is_active !== false);
}

export function canManageEvents(profileOrRole: ProfileLike | Role) {
  return isAdminLike(profileOrRole);
}

export function canCreateEvents(profileOrRole: ProfileLike | Role) {
  return isAdminLike(profileOrRole);
}

export function canPublishEvents(profileOrRole: ProfileLike | Role) {
  return isAdminLike(profileOrRole);
}

export function canDeleteEvents(profileOrRole: ProfileLike | Role) {
  return isAdminLike(profileOrRole);
}

export function canManageClients(profileOrRole: ProfileLike | Role) {
  const role = roleOf(profileOrRole);
  return isActive(profileOrRole) && (role === "super_admin" || role === "admin_kais" || role === "admin" || role === "vendedor");
}

export function canManageUsers(profileOrRole: ProfileLike | Role) {
  return isActive(profileOrRole) && roleOf(profileOrRole) === "super_admin";
}

export function canManageGuests(profileOrRole: ProfileLike | Role) {
  return isAdminLike(profileOrRole);
}

export function canViewRsvps(profileOrRole: ProfileLike | Role) {
  const role = roleOf(profileOrRole);
  return isAdminLike(profileOrRole) || (isActive(profileOrRole) && role === "soporte_evento");
}

export function canManagePhotos(profileOrRole: ProfileLike | Role) {
  const role = roleOf(profileOrRole);
  return isAdminLike(profileOrRole) || (isActive(profileOrRole) && role === "soporte_evento");
}

export function canManageEventAccess(profileOrRole: ProfileLike | Role) {
  return isAdminLike(profileOrRole);
}

export function canEditEventDesign(profileOrRole: ProfileLike | Role) {
  const role = roleOf(profileOrRole);
  return isAdminLike(profileOrRole) || (isActive(profileOrRole) && role === "diseñador");
}

export function canViewEventDetail(profileOrRole: ProfileLike | Role) {
  const role = roleOf(profileOrRole);
  return (
    isAdminLike(profileOrRole) ||
    (isActive(profileOrRole) && (role === "diseñador" || role === "soporte_evento"))
  );
}
