"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function RegisterForm({
  club,
  next,
}: {
  club?: string;
  next?: string;
}) {
  const [state, action, pending] = useActionState(register, undefined);
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  if (state?.message) {
    return <Alert>{state.message}</Alert>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {club && <input type="hidden" name="club" value={club} />}
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        id="full_name"
        label="Nombre completo"
        autoComplete="name"
        defaultValue={state?.fields?.full_name}
        required
      />
      <Field
        id="email"
        label="Correo"
        type="email"
        autoComplete="email"
        defaultValue={state?.fields?.email}
        required
      />
      <Field
        id="password"
        label="Contraseña (mínimo 8 caracteres)"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-body-md text-on-surface-variant">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref} className="text-primary underline">
          Ingresa
        </Link>
      </p>
    </form>
  );
}
