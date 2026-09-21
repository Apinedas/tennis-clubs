import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/dal";

export const metadata = { title: "Sin club · Academia de Tenis" };

export default async function NoClubPage() {
  const session = await requireSession();

  return (
    <>
      <h1 className="text-headline-lg text-on-surface">Aún no tienes un club</h1>
      <p className="text-body-md text-on-surface-variant">
        Tu cuenta ({session.email}) todavía no pertenece a ningún club. Pide al
        administrador de tu club un enlace de invitación, o regístrate desde el
        enlace público de tu club.
      </p>
      <form action={logout}>
        <Button type="submit" variant="secondary" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </>
  );
}
