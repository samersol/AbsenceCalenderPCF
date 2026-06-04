import * as React from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type AbsenceCode = "U" | "K" | "UF" | "KK" | "SU" | "SO";

export interface Employee {
  id: string;
  name: string;
  strEmployeeNumber?: string;
}

export interface AbsenceEntry {
  absenceEntryId: string;
  employeeId: string;
  absenceType: AbsenceCode;
  dteDateStart: string; // YYYY-MM-DD
  dteDateEnd: string;   // YYYY-MM-DD
}

export interface VacationEntry {
  employeeId: string;
  year: number;
  allowanceDays: number;
  carriedOver: number;
  totalQuota: number; // allowanceDays + carriedOver
}

export interface InteractionPayload {
  action: "add" | "remove" | "add_click" | "edit_click";
  employeeId: string;
  startDate: string;
  endDate: string;
  absenceType: AbsenceCode | "";
  recordId: string;
}

export interface IAbsenceCalendarProps {
  employees: Employee[];
  absences: AbsenceEntry[];
  vacationMap: Record<string, VacationEntry>;
  width: number;
  height: number;
  onInteraction: (payload: InteractionPayload) => void;
}

type Mode = "drag" | "klick";

interface DragState {
  empId: string;
  startDs: string;
  currentDs: string;
  blocked: boolean;
}

interface PendingAdd {
  empId: string;
  empName: string;
  startDate: string;
  endDate: string;
  dayCount: number;
}

interface CoverageInfo {
  entry: AbsenceEntry;
  isStart: boolean;
  isEnd: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_ABBR = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];

const GERMAN_MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function toDateStr(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

// Sachsen public holidays 2026
const SACHSEN_HOLIDAYS_2026 = new Set([
  "2026-01-01", // Neujahr
  "2026-04-03", // Karfreitag
  "2026-04-06", // Ostermontag
  "2026-05-01", // Tag der Arbeit
  "2026-05-14", // Christi Himmelfahrt
  "2026-05-25", // Pfingstmontag
  "2026-10-03", // Tag der Deutschen Einheit
  "2026-10-31", // Reformationstag
  "2026-11-18", // Buß- und Bettag
  "2026-12-25", // 1. Weihnachtstag
  "2026-12-26", // 2. Weihnachtstag
]);

function isHoliday(ds: string): boolean {
  return SACHSEN_HOLIDAYS_2026.has(ds);
}

function getCellBackground(ds: string, d: Date): string {
  if (isHoliday(ds)) return "#e0f2fe";
  if (isWeekend(d)) return "#f5f5f3";
  return "#fff";
}

function fmtDateDE(ds: string): string {
  const parts = ds.split("-");
  return parts[2] + "." + parts[1] + "." + parts[0];
}

function covKey(empId: string, ds: string): string {
  return empId + "_" + ds;
}

/** Count working days between two date strings (inclusive), excluding weekends and holidays. */
function countWorkingDays(startDs: string, endDs: string): number {
  const start = parseDateStr(startDs);
  const end = parseDateStr(endDs);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const ds = toDateStr(cur);
    if (!isWeekend(cur) && !isHoliday(ds)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const S = {
  card: {
    background: "#fff",
    borderRadius: 12,
    border: "1.5px solid #e0e0dc",
    overflow: "hidden" as const,
    position: "relative" as const,
    height: "100%",
    fontFamily: FONT,
    fontSize: 14,
    color: "#1a1a1a",
    display: "flex" as const,
    flexDirection: "column" as const,
  } as React.CSSProperties,

  gridScroll: {
    flex: 1,
    overflowY: "auto" as const,
    overflowX: "auto" as const,
    minHeight: 0,
  } as React.CSSProperties,

  toolbar: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 12,
    padding: "14px 20px",
    borderBottom: "1.5px solid #eee",
    flexWrap: "wrap" as const,
    flex: "0 0 auto" as const,
  } as React.CSSProperties,
  modeBtn: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 6,
    padding: "7px 14px",
    borderRadius: 8,
    border: "1.5px solid #d0d0cc",
    background: "#fff",
    cursor: "pointer" as const,
    fontSize: 13,
    fontWeight: 500,
    color: "#333",
  } as React.CSSProperties,
  modeBtnActive: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 6,
    padding: "7px 14px",
    borderRadius: 8,
    border: "1.5px solid #4a7c3f",
    background: "#4a7c3f",
    cursor: "pointer" as const,
    fontSize: 13,
    fontWeight: 500,
    color: "#fff",
  } as React.CSSProperties,
  divider: { width: 1, height: 24, background: "#e0e0dc" } as React.CSSProperties,
  typLabel: { fontSize: 13, color: "#666", fontWeight: 500 } as React.CSSProperties,
  typBtn: {
    padding: "6px 14px",
    borderRadius: 20,
    border: "1.5px solid #d0d0cc",
    background: "#fff",
    cursor: "pointer" as const,
    fontSize: 13,
    fontWeight: 500,
    color: "#444",
  } as React.CSSProperties,

  navRow: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: "12px 20px",
    borderBottom: "1.5px solid #eee",
    flex: "0 0 auto" as const,
  } as React.CSSProperties,
  navArrow: {
    width: 30,
    height: 30,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 6,
    border: "1.5px solid #d0d0cc",
    background: "#fff",
    cursor: "pointer" as const,
    fontSize: 16,
    color: "#444",
  } as React.CSSProperties,
  navTitle: { fontSize: 15, fontWeight: 600, color: "#222" } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    tableLayout: "fixed" as const,
  } as React.CSSProperties,

  thName: {
    textAlign: "left" as const,
    paddingLeft: 20,
    color: "#555",
    fontSize: 13,
    fontWeight: 600,
    borderBottom: "1.5px solid #eee",
    background: "#fff",
    width: 180,
    padding: "10px 6px 8px 20px",
  } as React.CSSProperties,
  thQuota: {
    fontSize: 11,
    color: "#999",
    fontWeight: 600,
    borderBottom: "1.5px solid #eee",
    background: "#fff",
    width: 56,
    textAlign: "center" as const,
    padding: "10px 6px 8px",
  } as React.CSSProperties,
  thDay: {
    padding: "10px 0 8px",
    textAlign: "center" as const,
    fontSize: 12,
    fontWeight: 600,
    color: "#777",
    borderBottom: "1.5px solid #eee",
    background: "#fff",
    width: 62,
  } as React.CSSProperties,
  dayAbbr: { display: "block" as const, fontSize: 11, color: "#999", marginBottom: 2 },
  dayNum: { display: "block" as const, fontSize: 15, fontWeight: 700, color: "#222", lineHeight: 1 },

  tdName: {
    textAlign: "left" as const,
    padding: "10px 12px 10px 20px",
    background: "#fff",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,
  tdQuota: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    textAlign: "center" as const,
    padding: "10px 6px",
    background: "#fff",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,
  tdQuotaRest: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center" as const,
    padding: "10px 6px",
    background: "#fff",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,
  td: {
    padding: "8px 0",
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    background: "#fff",
    width: 62,
  } as React.CSSProperties,

  empName: { fontWeight: 600, fontSize: 13, color: "#1a1a1a" } as React.CSSProperties,
  empId: { fontSize: 11, color: "#999", marginTop: 1 } as React.CSSProperties,

  spanChip: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: 28,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer" as const,
    userSelect: "none" as const,
    minWidth: 0,
  } as React.CSSProperties,

  legend: {
    display: "flex" as const,
    gap: 20,
    padding: "14px 20px",
    borderTop: "1.5px solid #eee",
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
    flex: "0 0 auto" as const,
  },

  // Sticky header helpers — applied per-cell for reliable cross-browser behaviour
  theadTh: { position: "sticky" as const, top: 0, zIndex: 2 } as React.CSSProperties,
  // Corner cells: sticky in both axes (higher z-index to sit above day-column headers)
  stickyCol0:   { position: "sticky" as const, left: 0,   zIndex: 3 } as React.CSSProperties,
  stickyCol180: { position: "sticky" as const, left: 180, zIndex: 3 } as React.CSSProperties,
  stickyCol236: { position: "sticky" as const, left: 236, zIndex: 3 } as React.CSSProperties,
  stickyCol292: { position: "sticky" as const, left: 292, zIndex: 3 } as React.CSSProperties,
  // Body fixed-column cells: above scrolling day cells, below header
  stickyTd0:   { position: "sticky" as const, left: 0,   zIndex: 1 } as React.CSSProperties,
  stickyTd180: { position: "sticky" as const, left: 180, zIndex: 1 } as React.CSSProperties,
  stickyTd236: { position: "sticky" as const, left: 236, zIndex: 1 } as React.CSSProperties,
  stickyTd292: { position: "sticky" as const, left: 292, zIndex: 1 } as React.CSSProperties,
  legendItem: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 6,
    fontSize: 13,
    color: "#555",
  },
  legendDot: { width: 14, height: 14, borderRadius: 4 } as React.CSSProperties,

  toastBase: {
    position: "absolute" as const,
    bottom: 24,
    left: "50%",
    background: "#222",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 13,
    pointerEvents: "none" as const,
    zIndex: 20,
    transition: "transform 0.25s, opacity 0.25s",
  } as React.CSSProperties,

  trBorder: { borderBottom: "1px solid #f0f0ee" } as React.CSSProperties,
  weekendBg: { background: "#f5f5f3" },
  dragHighlight: { background: "#fef3c7" },
  dragBlocked: { background: "#fee2e2" },

  // ── Modal (used for drag add popup and drag delete confirmation) ──
  modalOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  } as React.CSSProperties,
  modalCard: {
    background: "#fff",
    borderRadius: 12,
    border: "1.5px solid #e0e0dc",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    padding: "24px 28px",
    minWidth: 280,
    maxWidth: 360,
    fontFamily: FONT,
  } as React.CSSProperties,
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#222",
    marginBottom: 12,
  } as React.CSSProperties,
  typeBadge: {
    display: "inline-block" as const,
    padding: "4px 14px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10,
  } as React.CSSProperties,
  modalEmpName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#222",
    marginBottom: 6,
  } as React.CSSProperties,
  modalDetail: {
    fontSize: 13,
    color: "#555",
    lineHeight: 1.8,
  } as React.CSSProperties,
  modalActions: {
    display: "flex" as const,
    justifyContent: "center" as const,
    marginTop: 16,
  } as React.CSSProperties,
  modalConfirmBtn: {
    padding: "9px 24px",
    borderRadius: 8,
    border: "1.5px solid",
    cursor: "pointer" as const,
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
  } as React.CSSProperties,
};

// ── Color maps for 6 absence types ──────────────────────────────────────────

const CHIP_COLORS: Record<AbsenceCode, React.CSSProperties> = {
  U:  { background: "#FEF3C7", color: "#92400E" },
  K:  { background: "#FEE2E2", color: "#991B1B" },
  UF: { background: "#FCE4EC", color: "#880E4F" },
  KK: { background: "#FFF3E0", color: "#E65100" },
  SU: { background: "#E0F2FE", color: "#0C4A6E" },
  SO: { background: "#F3F4F6", color: "#374151" },
};

const TYP_ACTIVE_STYLES: Record<AbsenceCode, React.CSSProperties> = {
  U:  { background: "#FEF3C7", color: "#92400E", borderColor: "#FEF3C7" },
  K:  { background: "#FEE2E2", color: "#991B1B", borderColor: "#FEE2E2" },
  UF: { background: "#FCE4EC", color: "#880E4F", borderColor: "#FCE4EC" },
  KK: { background: "#FFF3E0", color: "#E65100", borderColor: "#FFF3E0" },
  SU: { background: "#E0F2FE", color: "#0C4A6E", borderColor: "#E0F2FE" },
  SO: { background: "#F3F4F6", color: "#374151", borderColor: "#F3F4F6" },
};

const TYP_CONFIRM_COLORS: Record<AbsenceCode, string> = {
  U:  "#92400E",
  K:  "#991B1B",
  UF: "#880E4F",
  KK: "#E65100",
  SU: "#0C4A6E",
  SO: "#374151",
};

const TYP_LABELS: Record<AbsenceCode, string> = {
  U:  "Urlaub",
  K:  "Krank",
  UF: "Unentsch. Fehlen",
  KK: "Kind krank",
  SU: "Sonderurlaub",
  SO: "Sonstiges",
};

const DOT_COLORS: Record<AbsenceCode, string> = {
  U:  "#FEF3C7",
  K:  "#FEE2E2",
  UF: "#FCE4EC",
  KK: "#FFF3E0",
  SU: "#E0F2FE",
  SO: "#F3F4F6",
};

const ALL_CODES: AbsenceCode[] = ["U", "K", "UF", "KK", "SU", "SO"];

// ── Component ────────────────────────────────────────────────────────────────

export const AbsenceCalendar: React.FC<IAbsenceCalendarProps> = ({
  employees,
  absences,
  vacationMap,
  width,
  height,
  onInteraction,
}) => {
  // ── State ──────────────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [mode, setMode] = React.useState<Mode>("drag");
  const [activeTyp, setActiveTyp] = React.useState<AbsenceCode>("U");
  const [localAbsences, setLocalAbsences] = React.useState<AbsenceEntry[]>([]);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [toastMsg, setToastMsg] = React.useState("");
  const [toastVisible, setToastVisible] = React.useState(false);
  const toastTimer = React.useRef(0);
  const [pendingAdd, setPendingAdd] = React.useState<PendingAdd | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<AbsenceEntry | null>(null);

  // Sync external absences into local state when props change
  React.useEffect(() => {
    setLocalAbsences([...absences]);
  }, [absences]);

  // ── Derived ────────────────────────────────────────────────────────────
  const viewDays = React.useMemo(() => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  }, [currentMonth]);

  const days = React.useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < viewDays; i++) arr.push(addDays(currentMonth, i));
    return arr;
  }, [currentMonth, viewDays]);

  const dayStrings = React.useMemo(() => days.map(toDateStr), [days]);

  const navTitle = React.useMemo(() => {
    return GERMAN_MONTHS[currentMonth.getMonth()] + " " + currentMonth.getFullYear();
  }, [currentMonth]);

  // Build coverage map: empId_YYYY-MM-DD → CoverageInfo
  const coverageMap = React.useMemo(() => {
    const map = new Map<string, CoverageInfo>();
    const firstVisible = dayStrings[0];
    const lastVisible = dayStrings[dayStrings.length - 1];

    for (const entry of localAbsences) {
      const visStart = entry.dteDateStart < firstVisible ? firstVisible : entry.dteDateStart;
      const visEnd = entry.dteDateEnd > lastVisible ? lastVisible : entry.dteDateEnd;
      if (visStart > lastVisible || visEnd < firstVisible) continue;

      const startD = parseDateStr(visStart);
      const endD = parseDateStr(visEnd);
      const cur = new Date(startD);
      while (cur <= endD) {
        const ds = toDateStr(cur);
        map.set(covKey(entry.employeeId, ds), {
          entry,
          isStart: ds === entry.dteDateStart,
          isEnd: ds === entry.dteDateEnd,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [localAbsences, dayStrings]);

  // ── Quota calculation (from vacationMap + localAbsences) ──
  const quotaMap = React.useMemo(() => {
    const result: Record<string, { annualQuota: number; usedDays: number; remainingDays: number }> = {};
    for (const emp of employees) {
      const vac = vacationMap[emp.id];
      const annualQuota = vac?.totalQuota ?? 0;

      // usedDays: sum intWorkDays for type "U" only
      // Since we don't have intWorkDays in AbsenceEntry, we count working days
      let usedDays = 0;
      for (const ab of localAbsences) {
        if (ab.employeeId === emp.id && ab.absenceType === "U") {
          usedDays += countWorkingDays(ab.dteDateStart, ab.dteDateEnd);
        }
      }

      result[emp.id] = {
        annualQuota,
        usedDays,
        remainingDays: annualQuota - usedDays,
      };
    }
    return result;
  }, [employees, vacationMap, localAbsences]);

  // Drag range indices + blocked status
  const dragRange = React.useMemo<{
    empId: string;
    a: number;
    b: number;
    blocked: boolean;
  } | null>(() => {
    if (!dragState) return null;
    const iS = dayStrings.indexOf(dragState.startDs);
    const iE = dayStrings.indexOf(dragState.currentDs);
    if (iS < 0 || iE < 0) return null;
    const a = Math.min(iS, iE);
    const b = Math.max(iS, iE);

    let blocked = false;
    for (let i = a; i <= b; i++) {
      if (coverageMap.has(covKey(dragState.empId, dayStrings[i]))) {
        blocked = true;
        break;
      }
    }
    return { empId: dragState.empId, a, b, blocked };
  }, [dragState, dayStrings, coverageMap]);

  // Helper: find employee name by id
  const empNameById = React.useCallback(
    (empId: string): string => {
      const emp = employees.find((e) => e.id === empId);
      return emp ? emp.name : empId;
    },
    [employees]
  );

  // ── Callbacks ──────────────────────────────────────────────────────────
  const showToast = React.useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2000);
  }, []);

  const navigateMonth = React.useCallback(
    (dir: number) =>
      setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1)),
    []
  );

  // ── Drag-mode add confirm (uses activeTyp, no param) ───────────────────
  const handleAddConfirm = React.useCallback(() => {
    if (!pendingAdd) return;
    const { empId, startDate: sd, endDate: ed } = pendingAdd;

    // No optimistic local add here: temp IDs can never match real Dataverse
    // GUIDs, which causes a brief double-render when the Canvas App refreshes.
    // Instead we close the modal immediately and let the Canvas App Patch +
    // Refresh cycle push the real record back into the dataset.

    // Notify Power Apps
    onInteraction({
      action: "add",
      employeeId: empId,
      startDate: sd,
      endDate: ed,
      absenceType: activeTyp,
      recordId: "",
    });

    showToast("Abwesenheit eingetragen");
    setPendingAdd(null);
  }, [pendingAdd, activeTyp, onInteraction, showToast]);

  const handleAddCancel = React.useCallback(() => {
    setPendingAdd(null);
  }, []);

  // ── Delete modal confirm (Drag mode only) ─────────────────────────────
  const handleDeleteConfirm = React.useCallback(() => {
    if (!pendingDelete) return;
    const entry = pendingDelete;

    // Optimistic: remove from local
    setLocalAbsences((prev) => prev.filter((e) => e.absenceEntryId !== entry.absenceEntryId));

    // Notify Power Apps
    onInteraction({
      action: "remove",
      employeeId: entry.employeeId,
      startDate: entry.dteDateStart,
      endDate: entry.dteDateEnd,
      absenceType: entry.absenceType,
      recordId: entry.absenceEntryId,
    });

    showToast("Abwesenheit entfernt");
    setPendingDelete(null);
  }, [pendingDelete, onInteraction, showToast]);

  const handleDeleteCancel = React.useCallback(() => {
    setPendingDelete(null);
  }, []);

  // ── Cell interactions ──────────────────────────────────────────────────
  const handleChipClick = React.useCallback(
    (e: React.MouseEvent, entry: AbsenceEntry) => {
      e.stopPropagation();
      e.preventDefault();
      if (mode === "klick") {
        // Klick mode: fire edit_click, no modal
        onInteraction({
          action: "edit_click",
          employeeId: entry.employeeId,
          startDate: entry.dteDateStart,
          endDate: entry.dteDateEnd,
          absenceType: entry.absenceType,
          recordId: entry.absenceEntryId,
        });
      } else {
        // Drag mode: show delete confirmation modal
        setPendingDelete(entry);
      }
    },
    [mode, onInteraction]
  );

  const handleCellDown = React.useCallback(
    (e: React.MouseEvent, empId: string, ds: string) => {
      if (pendingAdd || pendingDelete) return;
      if (coverageMap.has(covKey(empId, ds))) return; // occupied

      if (mode === "klick") {
        // Klick mode: fire add_click, no popup, no optimistic chip
        onInteraction({
          action: "add_click",
          employeeId: empId,
          startDate: ds,
          endDate: ds,
          absenceType: "",
          recordId: "",
        });
      } else {
        // Drag mode — start drag
        setDragState({ empId, startDs: ds, currentDs: ds, blocked: false });
        e.preventDefault();
      }
    },
    [mode, coverageMap, onInteraction, pendingAdd, pendingDelete]
  );

  const handleCellEnter = React.useCallback(
    (empId: string, ds: string) => {
      if (mode === "drag" && dragState && dragState.empId === empId) {
        setDragState((prev) => (prev ? { ...prev, currentDs: ds } : null));
      }
    },
    [mode, dragState]
  );

  const handleCellUp = React.useCallback(
    (e: React.MouseEvent) => {
      if (mode !== "drag" || !dragState || !dragRange) return;
      const { empId } = dragState;

      setDragState(null);

      if (dragRange.blocked) {
        showToast("Bereich \u00FCberlappt bestehende Abwesenheit");
        return;
      }

      const sd = dayStrings[dragRange.a];
      const ed = dayStrings[dragRange.b];
      const dayCount = dragRange.b - dragRange.a + 1;

      setPendingAdd({
        empId,
        empName: empNameById(empId),
        startDate: sd,
        endDate: ed,
        dayCount,
      });
    },
    [mode, dragState, dragRange, dayStrings, empNameById, showToast]
  );

  // Cancel drag on global mouseup — use window instead of document to work
  // correctly when the PCF is hosted inside a Canvas App iframe.
  React.useEffect(() => {
    const handler = () => {
      setDragState(null);
    };
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    ...S.card,
    width: width > 0 ? width : "100%",
    height: height > 0 ? height : "100%",
  };

  const toastStyle: React.CSSProperties = {
    ...S.toastBase,
    transform: toastVisible
      ? "translateX(-50%) translateY(0)"
      : "translateX(-50%) translateY(80px)",
    opacity: toastVisible ? 1 : 0,
  };

  return (
    <div style={cardStyle}>
      {/* Toolbar */}
        <div style={S.toolbar}>
          <button
            style={mode === "drag" ? S.modeBtnActive : S.modeBtn}
            onClick={() => setMode("drag")}
          >
            &#8862; Drag
          </button>
          <button
            style={mode === "klick" ? S.modeBtnActive : S.modeBtn}
            onClick={() => setMode("klick")}
          >
            &#9654; Klick
          </button>
          {mode === "drag" && (
            <>
              <div style={S.divider} />
              <span style={S.typLabel}>Typ:</span>
              {ALL_CODES.map((t) => (
                <button
                  key={t}
                  style={activeTyp === t ? { ...S.typBtn, ...TYP_ACTIVE_STYLES[t] } : S.typBtn}
                  onClick={() => setActiveTyp(t)}
                >
                  {TYP_LABELS[t]}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Nav */}
        <div style={S.navRow}>
          <button style={S.navArrow} onClick={() => navigateMonth(-1)}>
            &#8249;
          </button>
          <span style={S.navTitle}>{navTitle}</span>
          <button style={S.navArrow} onClick={() => navigateMonth(1)}>
            &#8250;
          </button>
        </div>

        {/* Grid */}
        <div style={S.gridScroll}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.thName, ...S.theadTh, ...S.stickyCol0 }}>Mitarbeiter</th>
                <th style={{ ...S.thQuota, ...S.theadTh, ...S.stickyCol180 }}>Ges.</th>
                <th style={{ ...S.thQuota, ...S.theadTh, ...S.stickyCol236 }}>Verbr.</th>
                <th style={{ ...S.thQuota, ...S.theadTh, ...S.stickyCol292 }}>Rest</th>
                {days.map((d, i) => (
                  <th key={i} style={{ ...S.thDay, ...S.theadTh, background: getCellBackground(dayStrings[i], d) }}>
                    <span style={S.dayAbbr}>{DAY_ABBR[d.getDay()]}</span>
                    <span style={S.dayNum}>{d.getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const quota = quotaMap[emp.id] ?? { annualQuota: 0, usedDays: 0, remainingDays: 0 };
                const subtitle = emp.strEmployeeNumber?.trim()
                  ? emp.strEmployeeNumber
                  : emp.id;

                return (
                  <tr key={emp.id} style={S.trBorder}>
                    <td style={{ ...S.tdName, ...S.stickyTd0 }}>
                      <div style={S.empName}>{emp.name}</div>
                      <div style={S.empId}>{subtitle}</div>
                    </td>
                    <td style={{ ...S.tdQuota, ...S.stickyTd180 }}>{quota.annualQuota}</td>
                    <td style={{ ...S.tdQuota, ...S.stickyTd236 }}>{quota.usedDays}</td>
                    <td
                      style={{
                        ...S.tdQuotaRest,
                        ...S.stickyTd292,
                        color: quota.remainingDays > 0 ? "#4a7c3f" : "#e07070",
                      }}
                    >
                      {quota.remainingDays}
                    </td>
                    {days.map((d, di) => {
                      const ds = dayStrings[di];
                      const info = coverageMap.get(covKey(emp.id, ds));

                      // Drag highlight
                      const inDrag =
                        dragRange &&
                        dragRange.empId === emp.id &&
                        di >= dragRange.a &&
                        di <= dragRange.b;
                      const dragBg = inDrag
                        ? dragRange.blocked
                          ? S.dragBlocked
                          : S.dragHighlight
                        : {};

                      const cellStyle: React.CSSProperties = {
                        ...S.td,
                        background: getCellBackground(ds, d),
                        ...dragBg,
                        cursor: mode === "drag" ? "cell" : "default",
                      };

                      if (info) {
                        // Render span chip segment
                        const { entry, isStart, isEnd } = info;
                        const chipStyle: React.CSSProperties = {
                          ...S.spanChip,
                          ...CHIP_COLORS[entry.absenceType],
                          borderRadius: isStart && isEnd
                            ? 6
                            : isStart
                              ? "6px 0 0 6px"
                              : isEnd
                                ? "0 6px 6px 0"
                                : 0,
                          marginLeft: isStart ? 3 : 0,
                          marginRight: isEnd ? 3 : 0,
                        };

                        return (
                          <td
                            key={ds}
                            style={cellStyle}
                            onMouseEnter={() => handleCellEnter(emp.id, ds)}
                          >
                            <div
                              style={chipStyle}
                              onClick={(e) => handleChipClick(e, entry)}
                            >
                              {isStart ? entry.absenceType : "\u00A0"}
                            </div>
                          </td>
                        );
                      }

                      // Empty cell
                      return (
                        <td
                          key={ds}
                          style={cellStyle}
                          onMouseDown={(e) => handleCellDown(e, emp.id, ds)}
                          onMouseEnter={() => handleCellEnter(emp.id, ds)}
                          onMouseUp={(e) => handleCellUp(e)}
                        >
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={S.legend}>
          {ALL_CODES.map((t) => (
            <div key={t} style={S.legendItem}>
              <div style={{ ...S.legendDot, background: DOT_COLORS[t] }} />
              {TYP_LABELS[t]}
            </div>
          ))}
          <div style={S.legendItem}>
            <div style={{ ...S.legendDot, background: "#e0f2fe", border: "1px solid #bae6fd" }} />
            Feiertag
          </div>
        </div>

      {/* ── Drag-mode Add Popup (absolute, centered in card) ── */}
      {pendingAdd && (
        <div style={S.modalOverlay} onClick={handleAddCancel}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...S.typeBadge, ...CHIP_COLORS[activeTyp] }}>
              {TYP_LABELS[activeTyp]}
            </div>
            <div style={S.modalEmpName}>{pendingAdd.empName}</div>
            <div style={S.modalDetail}>Von: {fmtDateDE(pendingAdd.startDate)}</div>
            <div style={S.modalDetail}>Bis: {fmtDateDE(pendingAdd.endDate)}</div>
            <div style={S.modalDetail}>
              Dauer: {pendingAdd.dayCount} Tage
            </div>
            <div style={S.modalActions}>
              <button
                style={{
                  ...S.modalConfirmBtn,
                  background: TYP_CONFIRM_COLORS[activeTyp],
                  borderColor: TYP_CONFIRM_COLORS[activeTyp],
                }}
                onClick={handleAddConfirm}
              >
                Best&auml;tigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal — Drag mode only (absolute, centered in card) ── */}
      {pendingDelete && (
        <div style={S.modalOverlay} onClick={handleDeleteCancel}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>Eintrag l&ouml;schen?</div>
            <div
              style={{
                ...S.typeBadge,
                ...CHIP_COLORS[pendingDelete.absenceType],
              }}
            >
              {TYP_LABELS[pendingDelete.absenceType]}
            </div>
            <div style={S.modalEmpName}>
              {empNameById(pendingDelete.employeeId)}
            </div>
            <div style={S.modalDetail}>
              Von: {fmtDateDE(pendingDelete.dteDateStart)}
            </div>
            <div style={S.modalDetail}>
              Bis: {fmtDateDE(pendingDelete.dteDateEnd)}
            </div>
            <div style={S.modalActions}>
              <button
                style={{
                  ...S.modalConfirmBtn,
                  background: "#e07070",
                  borderColor: "#e07070",
                }}
                onClick={handleDeleteConfirm}
              >
                L&ouml;schen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div style={toastStyle}>{toastMsg}</div>
    </div>
  );
};