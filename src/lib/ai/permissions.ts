export type AgentPermissions = { read?: string[]; write?: string[] };

// Escopo simples: o recurso precisa estar na lista do action, ou a lista ter "all".
export function checkPermission(
  perms: AgentPermissions,
  action: "read" | "write",
  resource: string,
): boolean {
  const scopes = perms[action] ?? [];
  return scopes.includes("all") || scopes.includes(resource);
}
