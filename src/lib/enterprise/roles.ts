/** Single source of truth for workspace roles. Used by the UI and by unit tests. Demo workspace only. */
export const ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" };
export const ROLE_BLURB: Record<Role, string> = {
  owner: "Full control, including billing and transferring ownership. Exactly one per workspace.",
  admin: "Manages people and projects. Cannot change Owners or other Admins.",
  editor: "Creates and edits projects. Read-only access to the team.",
  viewer: "Read-only access to the team, projects and usage.",
};
export const RANK: Record<Role, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };
export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

export const ACTIONS = [
  { id: "view_team", label: "View team members" },
  { id: "view_usage", label: "View credit usage" },
  { id: "view_projects", label: "View projects" },
  { id: "edit_projects", label: "Create and edit projects" },
  { id: "invite", label: "Invite people" },
  { id: "change_role", label: "Change roles" },
  { id: "remove", label: "Remove people" },
  { id: "export_usage", label: "Export usage (CSV)" },
  { id: "manage_billing", label: "Manage billing and add-ons" },
  { id: "transfer_ownership", label: "Transfer ownership" },
] as const;
export type Action = (typeof ACTIONS)[number]["id"];

const MATRIX: Record<Role, readonly Action[]> = {
  owner: ACTIONS.map((a) => a.id),
  admin: ["view_team", "view_usage", "view_projects", "edit_projects", "invite", "change_role", "remove", "export_usage"],
  editor: ["view_team", "view_usage", "view_projects", "edit_projects"],
  viewer: ["view_team", "view_usage", "view_projects"],
};

/** Can this role perform the action in general (target-specific rules live in canManage/canAssign). */
export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}

/** May `actor` change or remove a member who currently holds `target`? Owners are never touched here (use transfer). */
export function canManage(actor: Role, target: Role): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  if (actor === "admin") return target === "editor" || target === "viewer";
  return false;
}

/** Roles `actor` may assign to a member currently holding `target`. Never "owner" (ownership moves only via transfer). */
export function assignableRoles(actor: Role, target: Role): Role[] {
  if (!can(actor, "change_role") || !canManage(actor, target)) return [];
  if (actor === "owner") return ["admin", "editor", "viewer"];
  return ["editor", "viewer"];
}
export const canAssign = (actor: Role, target: Role, next: Role) => assignableRoles(actor, target).includes(next);

export const canRemove = (actor: Role, target: Role) => can(actor, "remove") && canManage(actor, target);
export const canTransfer = (actor: Role) => can(actor, "transfer_ownership");

/** Downgrades and promotions to Admin need an explicit confirmation. */
export function needsRoleConfirm(from: Role, to: Role): boolean {
  return to === "admin" || RANK[to] < RANK[from];
}
