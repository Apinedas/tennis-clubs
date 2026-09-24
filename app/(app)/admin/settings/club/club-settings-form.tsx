"use client";

import { useActionState, useRef, useState } from "react";
import { updateClubSettings } from "@/app/actions/club-settings";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type Club = Database["public"]["Tables"]["club"]["Row"];

const TIMEZONES = [
  { value: "America/Bogota", label: "América/Bogotá (UTC-05:00)" },
  { value: "America/Lima", label: "América/Lima (UTC-05:00)" },
  { value: "America/Panama", label: "América/Panamá (UTC-05:00)" },
  { value: "America/Mexico_City", label: "América/Ciudad de México (UTC-06:00)" },
  { value: "America/Santiago", label: "América/Santiago (UTC-04:00)" },
];

const CURRENCIES = [
  { value: "COP", label: "COP - Peso Colombiano ($)" },
  { value: "USD", label: "USD - Dólar Estadounidense (US$)" },
  { value: "EUR", label: "EUR - Euro (€)" },
  { value: "PEN", label: "PEN - Sol Peruano (S/)" },
];

// Swatches from the Stitch reference (verde oficial, verde bosque, azul
// cancha dura, ocre arcilla), plus a native picker for anything else.
const SWATCHES = [
  { hex: "#1B7F4F", name: "Verde Oficial" },
  { hex: "#0F5132", name: "Verde Bosque" },
  { hex: "#1E40AF", name: "Azul Cancha Dura" },
  { hex: "#B45309", name: "Ocre Arcilla" },
];

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = new Set(["image/png", "image/svg+xml", "image/jpeg"]);

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function ClubSettingsForm({
  club,
  memberCount,
}: {
  club: Club;
  memberCount: number;
}) {
  const [state, formAction, pending] = useActionState(updateClubSettings, undefined);

  const [slug, setSlug] = useState(club.slug);
  const [brandColor, setBrandColor] = useState(club.brand_color);
  const [colorName, setColorName] = useState("Personalizado");
  const [logoUrl, setLogoUrl] = useState(club.logo_url);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const registrationPath = `/register?club=${slug || "tu-club"}`;
  const registrationUrl =
    typeof window === "undefined"
      ? registrationPath
      : `${window.location.origin}${registrationPath}`;

  async function copyLink() {
    await navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function pickColor(hex: string, name: string) {
    setBrandColor(hex);
    setColorName(name);
  }

  async function handleLogoFile(file: File) {
    setLogoError(null);
    if (!LOGO_TYPES.has(file.type)) {
      setLogoError("Usa PNG, SVG o JPEG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("El archivo pesa más de 2MB.");
      return;
    }

    setLogoBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `${club.id}/logo.${ext}`;

      // Keep a single file per club: drop whatever was there before,
      // extension included, so switching from .png to .svg doesn't orphan
      // the old one.
      const { data: existing } = await supabase.storage
        .from("club-logos")
        .list(club.id);
      if (existing?.length) {
        await supabase.storage
          .from("club-logos")
          .remove(existing.map((f) => `${club.id}/${f.name}`));
      }

      const { error: uploadError } = await supabase.storage
        .from("club-logos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("club-logos").getPublicUrl(path);
      // Cache-bust so the new logo shows immediately after a re-upload with
      // the same extension.
      const url = `${publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("club")
        .update({ logo_url: url })
        .eq("id", club.id);
      if (updateError) throw updateError;

      setLogoUrl(url);
    } catch {
      setLogoError("No pudimos subir el logo. Inténtalo de nuevo.");
    } finally {
      setLogoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    setLogoError(null);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase.storage
        .from("club-logos")
        .list(club.id);
      if (existing?.length) {
        await supabase.storage
          .from("club-logos")
          .remove(existing.map((f) => `${club.id}/${f.name}`));
      }
      const { error } = await supabase
        .from("club")
        .update({ logo_url: null })
        .eq("id", club.id);
      if (error) throw error;
      setLogoUrl(null);
    } catch {
      setLogoError("No pudimos eliminar el logo.");
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="brand_color" value={brandColor} />

      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">
          Configuración del Club
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Datos generales, identidad de marca y parámetros de localización de
          la sede.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-container-lowest px-4 py-3">
        <div className="flex flex-col">
          <span className="text-label-xs uppercase text-on-surface-variant">
            Socios activos
          </span>
          <span className="text-body-md-medium text-on-surface">
            {memberCount} {memberCount === 1 ? "miembro" : "miembros"}
          </span>
        </div>
      </div>

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.message && <Alert>{state.message}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
            <div>
              <h2 className="text-headline-sm text-on-surface">
                Identidad Básica
              </h2>
              <p className="text-label-xs text-on-surface-variant">
                Nombre formal del establecimiento y dirección pública de
                registro.
              </p>
            </div>
            <Field
              id="name"
              label="Nombre oficial del Club o Sede"
              defaultValue={state?.fields?.name ?? club.name}
              placeholder="Ej. Club Deportivo San Lucas"
              hint="Aparece en comprobantes, recordatorios y en la pantalla de registro."
              required
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slug" className="text-label-sm text-on-surface-variant">
                Slug del enlace público de registro
              </label>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="h-10 rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary"
                required
              />
              <span className="text-label-xs text-on-surface-variant">
                Solo minúsculas, números y guiones medios. Cambiarlo invalida
                enlaces que ya compartiste.
              </span>
              <div className="mt-1 flex flex-col gap-2 rounded-lg bg-surface-container-low p-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden>
                    link
                  </span>
                  <span className="truncate text-body-md-medium text-primary">
                    {registrationUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center gap-1 rounded-lg bg-surface-container-lowest px-2.5 py-1.5 text-label-sm text-on-surface shadow-sm hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden>
                    {copied ? "done" : "content_copy"}
                  </span>
                  {copied ? "¡Copiado!" : "Copiar enlace"}
                </button>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
            <div>
              <h2 className="text-headline-sm text-on-surface">
                Contacto, Localización y Moneda
              </h2>
              <p className="text-label-xs text-on-surface-variant">
                Cómo te contactan los socios y cómo se calculan horarios y
                precios.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="contact_email"
                label="Correo de contacto"
                type="email"
                defaultValue={state?.fields?.contact_email ?? club.contact_email ?? ""}
                placeholder="recepcion@tuclub.co"
              />
              <Field
                id="contact_phone"
                label="Teléfono de contacto"
                defaultValue={state?.fields?.contact_phone ?? club.contact_phone ?? ""}
                placeholder="+57 300 000 0000"
              />
            </div>
            <Field
              id="address"
              label="Dirección"
              defaultValue={state?.fields?.address ?? club.address ?? ""}
              placeholder="Cra. 1 # 12-45, El Rodadero, Santa Marta"
              hint="Se muestra en el microsite público del club."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                id="timezone"
                label="Zona horaria del sistema"
                defaultValue={state?.fields?.timezone ?? club.timezone}
                hint="Controla la hora de los turnos y la apertura de canchas."
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
              <Select
                id="currency"
                label="Moneda operativa de cobro"
                defaultValue={state?.fields?.currency ?? club.currency}
                hint="La usará el módulo de Tarifas cuando esté disponible."
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-6 shadow-sm">
            <div>
              <h2 className="text-headline-sm text-on-surface">
                Identidad de Marca
              </h2>
              <p className="text-label-xs text-on-surface-variant">
                Personalización visual para socios y deportistas.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-label-sm text-on-surface-variant">
                Logotipo del Club
              </span>
              <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-container-low p-4 sm:flex-row">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-lowest p-1.5 shadow-sm">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, no static size known
                    <img
                      src={logoUrl}
                      alt={`Logo de ${club.name}`}
                      className="h-full w-full rounded-lg object-contain"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-on-surface-variant" aria-hidden>
                      sports_tennis
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 text-center sm:text-left">
                  <span className="text-label-xs text-on-surface-variant">
                    PNG o SVG, máx 2MB.
                  </span>
                  {logoError && (
                    <span className="text-label-xs text-blocked-fg">{logoError}</span>
                  )}
                  <div className="mt-1 flex items-center justify-center gap-2 sm:justify-start">
                    <label className="flex cursor-pointer items-center gap-1 rounded bg-surface-container-lowest px-2 py-1 text-label-sm text-on-surface shadow-sm hover:bg-surface-container">
                      <span className="material-symbols-outlined text-[16px]" aria-hidden>
                        upload_file
                      </span>
                      {logoBusy ? "Subiendo…" : "Cambiar logo"}
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/svg+xml,image/jpeg"
                        className="hidden"
                        disabled={logoBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleLogoFile(file);
                        }}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        disabled={logoBusy}
                        onClick={removeLogo}
                        className="flex items-center gap-1 rounded bg-surface-container-lowest px-2 py-1 text-label-sm text-blocked-fg shadow-sm hover:bg-blocked-bg"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden>
                          delete
                        </span>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-label-sm text-on-surface-variant">
                Color Primario
              </label>
              <div className="flex items-center gap-2">
                {SWATCHES.map((s) => (
                  <button
                    key={s.hex}
                    type="button"
                    title={s.name}
                    onClick={() => pickColor(s.hex, s.name)}
                    className="h-10 w-10 rounded-lg shadow-sm ring-offset-2 transition-transform hover:scale-105"
                    style={{
                      backgroundColor: s.hex,
                      outline:
                        brandColor.toUpperCase() === s.hex
                          ? "2px solid var(--color-primary)"
                          : "none",
                      outlineOffset: 2,
                    }}
                  >
                    {brandColor.toUpperCase() === s.hex && (
                      <span className="material-symbols-outlined text-[18px] text-white" aria-hidden>
                        check
                      </span>
                    )}
                  </button>
                ))}
                <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-surface-container">
                  <span className="material-symbols-outlined pointer-events-none text-[18px] text-on-surface-variant" aria-hidden>
                    colorize
                  </span>
                  <input
                    type="color"
                    value={HEX_RE.test(brandColor) ? brandColor : "#1B7F4F"}
                    onChange={(e) => pickColor(e.target.value, "Personalizado")}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 flex-1 items-center rounded-lg border border-border px-3">
                  <span className="pr-1 text-body-md-medium text-on-surface-variant">
                    #
                  </span>
                  <input
                    value={brandColor.replace("#", "")}
                    maxLength={6}
                    onChange={(e) => {
                      const hex = `#${e.target.value}`;
                      setBrandColor(hex);
                      if (HEX_RE.test(hex)) setColorName("Personalizado");
                    }}
                    className="w-full bg-transparent text-body-md-medium uppercase text-on-surface outline-none"
                  />
                </div>
                <div
                  className="h-10 w-10 shrink-0 rounded-lg shadow-sm"
                  style={{
                    backgroundColor: HEX_RE.test(brandColor) ? brandColor : "transparent",
                  }}
                />
              </div>
              {!HEX_RE.test(brandColor) && (
                <span className="text-label-xs text-blocked-fg">
                  Debe ser un color hex de 6 dígitos, ej. 1B7F4F.
                </span>
              )}
              <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-xs font-bold uppercase text-on-surface-variant">
                    Vista previa
                  </span>
                  <span className="text-label-xs text-on-surface-variant">
                    {colorName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-lowest p-3 shadow-sm">
                  <span
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-body-md-medium text-white"
                    style={{
                      backgroundColor: HEX_RE.test(brandColor) ? brandColor : "#1B7F4F",
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden>
                      sports_tennis
                    </span>
                    Reservar Cancha
                  </span>
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-label-sm font-medium"
                    style={{
                      color: HEX_RE.test(brandColor) ? brandColor : "#1B7F4F",
                      backgroundColor: "var(--color-available-bg)",
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                    Turno Disponible
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !HEX_RE.test(brandColor)}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
