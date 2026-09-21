export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center p-margin">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" aria-hidden>
            sports_tennis
          </span>
          <span className="text-headline-sm text-on-surface">
            Academia de Tenis
          </span>
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-container-lowest p-4">
          {children}
        </div>
      </div>
    </main>
  );
}
