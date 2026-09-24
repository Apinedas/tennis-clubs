"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm"
    >
      <h2 className="text-headline-sm text-on-surface">Datos de contacto</h2>

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.message && <Alert>{state.message}</Alert>}

      <Field
        id="full_name"
        label="Nombre completo"
        defaultValue={state?.fields?.full_name ?? fullName}
        required
      />
      <Field
        id="phone"
        label="Teléfono"
        defaultValue={state?.fields?.phone ?? phone}
        placeholder="+57 300 000 0000"
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
