import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_LABELS, SURFACE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/club/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_club", { p_slug: slug });
  const club = Array.isArray(data) ? data[0] : null;
  return { title: club ? `${club.name} · Academia de Tenis` : "Club no encontrado" };
}

// Public page: no session required (see PUBLIC_PREFIXES in lib/auth/roles.ts).
// Shows the club's identity and links into the real booking/lesson flows —
// it doesn't reimplement live availability, which already exists behind
// login at /student/book and /student/lessons.
export default async function ClubMicrositePage({
  params,
}: PageProps<"/club/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const [{ data: clubData }, { data: courts }, { data: coaches }, { data: rates }] =
    await Promise.all([
      supabase.rpc("public_club", { p_slug: slug }),
      supabase.rpc("public_club_courts", { p_slug: slug }),
      supabase.rpc("public_club_coaches", { p_slug: slug }),
      supabase.rpc("public_club_rates", { p_slug: slug }),
    ]);

  const club = Array.isArray(clubData) ? clubData[0] : null;
  if (!club) notFound();

  const bookNext = encodeURIComponent("/student/book");
  const lessonNext = encodeURIComponent("/student/lessons");
  const registerHref = (next: string) => `/register?club=${slug}&next=${next}`;
  const loginHref = (next: string) => `/login?next=${next}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-background px-margin py-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, no static size known
            <img src={club.logo_url} alt={club.name} className="h-14 w-14 rounded-xl object-contain" />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-xl text-on-primary"
              style={{ backgroundColor: club.brand_color ?? "#1B7F4F" }}
            >
              <span className="material-symbols-outlined" aria-hidden>
                sports_tennis
              </span>
            </span>
          )}
          <div>
            <h1 className="text-headline-lg text-on-surface">{club.name}</h1>
            <p className="text-label-sm text-on-surface-variant">Lun–Dom · 06:00–22:00</p>
          </div>
          <Link
            href={loginHref("/")}
            className="ml-auto text-label-sm text-primary hover:underline"
          >
            Ingreso socios
          </Link>
        </div>
        {club.address && (
          <p className="flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              location_on
            </span>
            {club.address}
          </p>
        )}
      </header>

      {courts && courts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-headline-sm text-on-surface">Canchas</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {courts.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm"
              >
                <div>
                  <p className="text-body-md-medium text-on-surface">{c.name}</p>
                  <p className="text-label-xs text-on-surface-variant">
                    {SURFACE_LABELS[c.surface]}
                    {c.covered ? " · Techada" : " · Al aire libre"}
                  </p>
                </div>
                <Link
                  href={registerHref(bookNext)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-label-sm text-white"
                  style={{ backgroundColor: club.brand_color ?? "#1B7F4F" }}
                >
                  Reservar
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {coaches && coaches.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-headline-sm text-on-surface">Cuerpo técnico</h2>
          <div className="flex flex-col gap-2">
            {coaches.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-container-lowest p-4 shadow-sm"
              >
                <div>
                  <p className="text-body-md-medium text-on-surface">{c.full_name}</p>
                  {c.title && <p className="text-label-xs text-on-surface-variant">{c.title}</p>}
                </div>
                <Link
                  href={registerHref(lessonNext)}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-label-sm text-on-surface hover:bg-background"
                >
                  Consultar clase
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {rates && rates.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-headline-sm text-on-surface">Tarifas</h2>
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-container-lowest p-2 shadow-sm">
            {rates.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 px-2 py-2 text-body-md text-on-surface last:pb-1"
              >
                <span>
                  {r.name}
                  {r.category && (
                    <span className="ml-1.5 text-label-xs text-on-surface-variant">
                      ({CATEGORY_LABELS[r.category]})
                    </span>
                  )}
                </span>
                <span className="text-body-md-medium">${r.price_amount.toLocaleString("es-CO")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-container p-4">
        <p className="text-body-md-medium text-on-surface">¿Ya tienes cuenta?</p>
        <div className="flex gap-2">
          <Link
            href={loginHref("/")}
            className="flex-1 rounded-lg px-4 py-2.5 text-center text-body-md-medium text-white"
            style={{ backgroundColor: club.brand_color ?? "#1B7F4F" }}
          >
            Iniciar sesión
          </Link>
          {club.open_registration && (
            <Link
              href={registerHref(encodeURIComponent("/"))}
              className="flex-1 rounded-lg border border-border bg-surface-container-lowest px-4 py-2.5 text-center text-body-md-medium text-on-surface hover:bg-background"
            >
              Crear cuenta
            </Link>
          )}
        </div>
      </section>

      {(club.contact_email || club.contact_phone) && (
        <footer className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          {club.contact_phone && <p>📞 {club.contact_phone}</p>}
          {club.contact_email && <p>✉️ {club.contact_email}</p>}
        </footer>
      )}
    </main>
  );
}
