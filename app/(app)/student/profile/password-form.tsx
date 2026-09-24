"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/profile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm"
    >
      <h2 className="text-headline-sm text-on-surface">Cambiar contraseña</h2>

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.message && <Alert>{state.message}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="password"
          label="Nueva contraseña"
          type="password"
          minLength={8}
          required
        />
        <Field
          id="confirm_password"
          label="Confirmar contraseña"
          type="password"
          minLength={8}
          required
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Actualizando…" : "Actualizar contraseña"}
        </Button>
      </div>
    </form>
  );
}
