"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <form action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
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
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="text-body-md text-on-surface-variant">
        ¿No tienes cuenta?{" "}
        <Link href={registerHref} className="text-primary underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
