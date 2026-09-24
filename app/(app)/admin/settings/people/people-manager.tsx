"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  inviteMember,
  removeMembership,
  revokeInvitation,
  toggleMembershipActive,
  updateMember,
} from "@/app/actions/people-settings";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { Database } from "@/lib/database.types";

type Member = {
  person_id: string;
  full_name: string;
  phone: string | null;
  email: string;
  title: string | null;
  member_number: string | null;
  roles: Role[];
  active: boolean;
  created_at: string;
};

type Invitation = Database["public"]["Tables"]["invitation"]["Row"];

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [Role, string][];

function exportCsv(members: Member[]) {
  const header = ["Nombre", "Correo", "Roles", "Estado"];
  const rows = members.map((m) => [
    m.full_name,
    m.email,
    m.roles.map((r) => ROLE_LABELS[r]).join(" / "),
    m.active ? "Activa" : "Inactiva",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "personas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PeopleManager({
  members,
  invitations,
}: {
  members: Member[];
  invitations: Invitation[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && !m.roles.includes(roleFilter)) return false;
      if (
        term &&
        !m.full_name.toLowerCase().includes(term) &&
        !m.email.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [members, search, roleFilter]);

  const counts = {
    total: members.length,
    students: members.filter((m) => m.roles.includes("student")).length,
    coaches: members.filter((m) => m.roles.includes("coach")).length,
    inactive: members.filter((m) => !m.active).length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Directorio de Personas</h1>
        <p className="text-body-md text-on-surface-variant">
          Roles del personal del club, entrenadores y alumnos.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label="Total" value={counts.total} />
        <Stat label="Alumnos" value={counts.students} />
        <Stat label="Entrenadores" value={counts.coaches} />
        <Stat label="Inactivos" value={counts.inactive} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="h-10 w-full max-w-xs rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary"
          />
          <FilterChip
            label="Todos"
            active={roleFilter === "all"}
            onClick={() => setRoleFilter("all")}
          />
          {ROLE_OPTIONS.map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              active={roleFilter === value}
              onClick={() => setRoleFilter(value)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => exportCsv(members)}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              download
            </span>
            Exportar CSV
          </Button>
          <Button type="button" onClick={() => setInvitePanelOpen(true)}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              person_add
            </span>
            Invitar persona
          </Button>
        </div>
      </div>

      {invitePanelOpen && (
        <InvitePanel onClose={() => setInvitePanelOpen(false)} />
      )}

      {invitations.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm">
          <h2 className="text-headline-sm text-on-surface">
            Invitaciones pendientes
          </h2>
          <ul className="flex flex-col gap-2">
            {invitations.map((inv) => (
              <PendingInvitation key={inv.id} invitation={inv} />
            ))}
          </ul>
        </section>
      )}

      {editingMember && (
        <PersonPanel
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-container-lowest shadow-sm">
        <table className="w-full min-w-[840px] text-left">
          <thead>
            <tr className="border-b border-border text-label-sm text-on-surface-variant">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((member) => (
              <tr key={member.person_id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="text-body-md-medium text-on-surface">{member.full_name}</p>
                  <p className="text-label-xs text-on-surface-variant">
                    {[member.member_number, member.title].filter(Boolean).join(" · ") || "—"}
                  </p>
                </td>
                <td className="px-4 py-3 text-body-md text-on-surface">{member.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {member.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-md border border-border bg-surface-container px-2 py-0.5 text-label-xs text-on-surface"
                      >
                        {ROLE_LABELS[r]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ActiveToggle personId={member.person_id} active={member.active} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingMember(member)}
                      className="text-label-sm text-primary hover:underline"
                    >
                      Editar
                    </button>
                    <RemoveMemberButton
                      personId={member.person_id}
                      name={member.full_name}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {visibleMembers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-body-md text-on-surface-variant"
                >
                  No hay personas que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-container-lowest px-4 py-2">
      <span className="text-label-xs uppercase text-on-surface-variant">{label}</span>
      <span className="text-body-md-medium text-on-surface">{value}</span>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-primary px-3 py-1.5 text-label-sm text-on-primary"
          : "rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container"
      }
    >
      {label}
    </button>
  );
}

function ActiveToggle({ personId, active }: { personId: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(
    toggleMembershipActive,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="person_id" value={personId} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <Checkbox
        id={`member-active-${personId}`}
        label={active ? "Activa" : "Inactiva"}
        checked={active}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
      />
      {state?.error && (
        <span className="mt-1 block max-w-[200px] text-label-xs text-blocked-fg">
          {state.error}
        </span>
      )}
    </form>
  );
}

function RemoveMemberButton({ personId, name }: { personId: string; name: string }) {
  const [state, formAction, pending] = useActionState(removeMembership, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="person_id" value={personId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm(`¿Quitar a ${name} del club?`)) e.preventDefault();
        }}
        className="text-label-sm text-blocked-fg hover:underline disabled:opacity-60"
      >
        Quitar
      </button>
      {state?.error && (
        <p className="mt-1 max-w-[220px] text-label-xs text-blocked-fg">{state.error}</p>
      )}
    </form>
  );
}

function PendingInvitation({ invitation }: { invitation: Invitation }) {
  const [state, formAction, pending] = useActionState(revokeInvitation, undefined);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/invitation/${invitation.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-body-md-medium text-on-surface">{invitation.email}</p>
        <p className="text-label-xs text-on-surface-variant">
          {invitation.roles.map((r) => ROLE_LABELS[r]).join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copyLink}
          className="text-label-sm text-primary hover:underline"
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
        <form action={formAction}>
          <input type="hidden" name="invitation_id" value={invitation.id} />
          <button
            type="submit"
            disabled={pending}
            className="text-label-sm text-blocked-fg hover:underline disabled:opacity-60"
          >
            Revocar
          </button>
        </form>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
    </li>
  );
}

function InvitePanel({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(inviteMember, undefined);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state?.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">Invitar persona</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          Cerrar
        </button>
      </div>

      {state?.inviteUrl ? (
        <div className="flex flex-col gap-2">
          <Alert>
            Invitación creada. Comparte este enlace; expira en 7 días.
          </Alert>
          <div className="flex items-center gap-2 rounded-lg bg-surface-container-low p-2">
            <span className="min-w-0 flex-1 truncate text-body-md-medium text-primary">
              {state.inviteUrl}
            </span>
            <Button type="button" variant="secondary" onClick={copyLink}>
              {copied ? "¡Copiado!" : "Copiar"}
            </Button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && <Alert tone="error">{state.error}</Alert>}
          <Field
            id="email"
            label="Correo electrónico"
            type="email"
            defaultValue={state?.fields?.email ?? ""}
            placeholder="persona@correo.com"
            required
          />
          <div className="flex flex-col gap-2">
            <span className="text-label-sm text-on-surface-variant">Roles</span>
            <div className="flex flex-wrap gap-4">
              {ROLE_OPTIONS.map(([value, label]) => (
                <Checkbox key={value} id={`invite-role-${value}`} name="roles" value={value} label={label} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear invitación"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function PersonPanel({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateMember, undefined);

  useEffect(() => {
    if (state?.message) onClose();
    // Only react to a successful save; onClose is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm text-on-surface">{member.full_name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          Cerrar
        </button>
      </div>

      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="person_id" value={member.person_id} />
        <div className="flex flex-col gap-2">
          <span className="text-label-sm text-on-surface-variant">Roles</span>
          <div className="flex flex-wrap gap-4">
            {ROLE_OPTIONS.map(([value, label]) => (
              <Checkbox
                key={value}
                id={`edit-role-${value}`}
                name="roles"
                value={value}
                label={label}
                defaultChecked={member.roles.includes(value)}
              />
            ))}
          </div>
        </div>
        <Field
          id="title"
          label="Cargo o nota (opcional)"
          defaultValue={state?.fields?.title ?? member.title ?? ""}
          placeholder="Ej. Entrenadora Principal"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </section>
  );
}
