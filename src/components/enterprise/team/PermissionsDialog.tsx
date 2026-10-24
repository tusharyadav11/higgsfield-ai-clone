"use client";
import { Check, Minus } from "lucide-react";
import { ACTIONS, can, ROLES, ROLE_BLURB, ROLE_LABEL } from "@/lib/enterprise/roles";
import { Modal } from "./Modal";

export function PermissionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Roles and permissions" testid="permissions-dialog">
      <p className="text-sm text-muted">What each role can do in this demo workspace. The same rules drive every control on the Team page.</p>
      <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-line">
        <table className="w-full min-w-[480px] text-left text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Permission</th>
              {ROLES.map((r) => <th key={r} scope="col" className="px-3 py-2 text-center font-medium">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <th scope="row" className="px-3 py-2 font-normal">{a.label}</th>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2 text-center">
                    {can(r, a.id) ? <Check className="mx-auto size-4 text-success" aria-label="Allowed" /> : <Minus className="mx-auto size-4 text-muted" aria-label="Not allowed" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
        {ROLES.map((r) => (
          <div key={r}><dt className="inline font-semibold text-fg">{ROLE_LABEL[r]}: </dt><dd className="inline">{ROLE_BLURB[r]}</dd></div>
        ))}
      </dl>
    </Modal>
  );
}
