"use client";

import { useActionState } from "react";
import { markAttendance } from "@/app/actions/courses";
import { IconButton } from "@/components/ui/icon-button";
import type { Database } from "@/lib/database.types";

type RosterRow = Database["public"]["Functions"]["list_course_roster"]["Returns"][number];

export function AttendanceRoster({
  sessionId,
  roster,
  attendanceByPerson,
}: {
  sessionId: string;
  roster: RosterRow[];
  attendanceByPerson: Record<string, boolean>;
}) {
  if (roster.length === 0) {
    return (
      <p className="rounded-lg bg-surface-container p-3 text-label-xs text-on-surface-variant">
        Nadie con inscripción confirmada todavía.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 rounded-lg bg-surface-container p-2">
      {roster.map((r) => (
        <AttendanceRow
          key={r.person_id}
          sessionId={sessionId}
          row={r}
          current={attendanceByPerson[r.person_id]}
        />
      ))}
    </ul>
  );
}

function AttendanceRow({
  sessionId,
  row,
  current,
}: {
  sessionId: string;
  row: RosterRow;
  current: boolean | undefined;
}) {
  const [presentState, presentAction, presentPending] = useActionState(markAttendance, undefined);
  const [absentState, absentAction, absentPending] = useActionState(markAttendance, undefined);
  const pending = presentPending || absentPending;

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-lowest px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-body-md text-on-surface">{row.full_name}</span>
        {current === true && (
          <span className="text-label-xs text-available-fg">Presente</span>
        )}
        {current === false && <span className="text-label-xs text-blocked-fg">Ausente</span>}
      </div>
      <div className="flex items-center gap-1">
        <form action={presentAction}>
          <input type="hidden" name="session_booking_id" value={sessionId} />
          <input type="hidden" name="person_id" value={row.person_id} />
          <input type="hidden" name="present" value="true" />
          <IconButton
            icon="check_circle"
            label="Marcar presente"
            type="submit"
            disabled={pending}
            className={current === true ? "text-available-fg" : undefined}
          />
        </form>
        <form action={absentAction}>
          <input type="hidden" name="session_booking_id" value={sessionId} />
          <input type="hidden" name="person_id" value={row.person_id} />
          <input type="hidden" name="present" value="false" />
          <IconButton
            icon="cancel"
            label="Marcar ausente"
            tone="danger"
            type="submit"
            disabled={pending}
            className={current === false ? "bg-blocked-bg" : undefined}
          />
        </form>
      </div>
      {(presentState?.error || absentState?.error) && (
        <span className="text-label-xs text-blocked-fg">
          {presentState?.error ?? absentState?.error}
        </span>
      )}
    </li>
  );
}
