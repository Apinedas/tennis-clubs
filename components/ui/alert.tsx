type Tone = "error" | "info";

const TONES: Record<Tone, string> = {
  error: "border-blocked-border bg-blocked-bg text-blocked-fg",
  info: "border-available-border bg-available-bg text-available-fg",
};

export function Alert({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-body-md ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}
