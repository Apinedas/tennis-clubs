import { Alert } from "@/components/ui/alert";
import { safeNext } from "@/lib/auth/redirect";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar · Academia de Tenis" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);

  return (
    <>
      <h1 className="text-headline-lg text-on-surface">Ingresar</h1>
      {params.error === "confirm" && (
        <Alert tone="error">
          No pudimos confirmar tu correo. El enlace pudo haber expirado.
        </Alert>
      )}
      <LoginForm next={next ?? undefined} />
    </>
  );
}
