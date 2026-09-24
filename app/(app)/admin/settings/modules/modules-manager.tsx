"use client";

import { useActionState, useRef } from "react";
import { toggleModule } from "@/app/actions/module-settings";
import { Checkbox } from "@/components/ui/checkbox";
import type { Database } from "@/lib/database.types";
import { MODULES, type ClubModuleName } from "@/lib/modules";

type ModuleRow = Database["public"]["Tables"]["club_module"]["Row"];

export function ModulesManager({
  modules,
  isPlatformAdmin,
}: {
  modules: ModuleRow[];
  isPlatformAdmin: boolean;
}) {
  const byName = new Map(modules.map((m) => [m.module, m]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">
          Módulos y Capacidades del Sistema
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Activa o desactiva las funcionalidades operativas del club.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {MODULES.map((def) => {
          const row = byName.get(def.value);
          if (!row) return null;
          const locked = row.platform_only && !isPlatformAdmin;

          return (
            <section
              key={def.value}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-headline-sm text-on-surface">{def.label}</h2>
                  {row.active ? (
                    <span className="rounded-md border border-available-border bg-available-bg px-2 py-0.5 text-label-xs text-available-fg">
                      Operativo
                    </span>
                  ) : (
                    <span className="rounded-md border border-border bg-surface-container px-2 py-0.5 text-label-xs text-on-surface-variant">
                      Inactivo
                    </span>
                  )}
                  {row.platform_only && (
                    <span className="rounded-md border border-blocked-border bg-blocked-bg px-2 py-0.5 text-label-xs text-blocked-fg">
                      Solo plataforma
                    </span>
                  )}
                </div>
                <p className="text-body-md text-on-surface-variant">
                  {def.description}
                </p>
                {locked && (
                  <p className="text-label-xs text-on-surface-variant">
                    Este módulo está en beta. Contacta a soporte para activarlo en tu club.
                  </p>
                )}
              </div>
              <ModuleToggle
                module={def.value}
                active={row.active}
                disabled={locked}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ModuleToggle({
  module,
  active,
  disabled,
}: {
  module: ClubModuleName;
  active: boolean;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleModule, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="shrink-0">
      <input type="hidden" name="module" value={module} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <Checkbox
        id={`module-active-${module}`}
        label={active ? "Activo" : "Inactivo"}
        checked={active}
        disabled={disabled || pending}
        onChange={() => formRef.current?.requestSubmit()}
      />
      {state?.error && (
        <p className="mt-1 max-w-[180px] text-label-xs text-blocked-fg">{state.error}</p>
      )}
    </form>
  );
}
