import { IInputs, IOutputs } from "./generated/ManifestTypes";
import {
  AbsenceCalendar,
  IAbsenceCalendarProps,
  AbsenceCode,
  AbsenceEntry,
  Employee,
  InteractionPayload,
  VacationEntry,
} from "./AbsenceCalendar";
import * as React from "react";

const TYPE_MAP: Record<string, AbsenceCode> = {
  U: "U",
  K: "K",
  UF: "UF",
  KK: "KK",
  SU: "SU",
  SO: "SO",
};

function toDateStr(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/** Returns true when the dataset is fully loaded (all pages). */
function isDatasetReady(
  dataSet: ComponentFramework.PropertyTypes.DataSet
): boolean {
  if (dataSet.loading) return false;
  if (dataSet.paging.hasNextPage) {
    dataSet.paging.loadNextPage();
    return false;
  }
  return true;
}

export class AbsenceCalendarV4
  implements ComponentFramework.ReactControl<IInputs, IOutputs>
{
  private notifyOutputChanged: () => void;
  private lastElement: React.ReactElement | null = null;

  // Output property values
  private selectedEmployeeId = "";
  private selectedStartDate = "";
  private selectedEndDate = "";
  private selectedAbsenceType = "";
  private selectedAction = "";
  private selectedRecordId = "";
  // Monotonically-increasing token so Canvas App OnChange fires even when
  // the same action is repeated (e.g. two consecutive "add" operations).
  private selectedEventId = "";

  constructor() {
    // Empty
  }

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary
  ): void {
    this.notifyOutputChanged = notifyOutputChanged;
    context.mode.trackContainerResize(true);
  }

  public updateView(
    context: ComponentFramework.Context<IInputs>
  ): React.ReactElement {
    const absenceDS = context.parameters.absenceDataSet;
    const employeeDS = context.parameters.employeeDataSet;
    const vacationDS = context.parameters.vacationDataSet;

    // ── Paging: wait until all three datasets are fully loaded ──
    if (
      !isDatasetReady(absenceDS) ||
      !isDatasetReady(employeeDS) ||
      !isDatasetReady(vacationDS)
    ) {
      return (
        this.lastElement ?? React.createElement("div", null, "Loading...")
      );
    }

    // ── Build AbsenceEntry[] from absenceDataSet ──
    const absences: AbsenceEntry[] = [];
    for (const id of absenceDS.sortedRecordIds) {
      const rec = absenceDS.records[id];

      const absenceEntryId =
        (rec.getValue("absenceEntryId") as string) ?? "";
      const empId =
        (rec.getValue("employeeId") as string) ?? "";
      const typeRaw =
        (rec.getValue("absenceType") as string) ?? "";
      const startRaw = rec.getValue("dteDateStart");
      const endRaw = rec.getValue("dteDateEnd");

      const code = TYPE_MAP[typeRaw];
      if (!code || !empId) continue;

      // Parse dates
      let startStr: string;
      if (startRaw instanceof Date) {
        startStr = toDateStr(startRaw);
      } else if (typeof startRaw === "string" && startRaw) {
        startStr = startRaw;
      } else {
        continue;
      }

      let endStr: string;
      if (endRaw instanceof Date) {
        endStr = toDateStr(endRaw);
      } else if (typeof endRaw === "string" && endRaw) {
        endStr = endRaw;
      } else {
        continue;
      }

      absences.push({
        absenceEntryId,
        employeeId: empId,
        absenceType: code,
        dteDateStart: startStr,
        dteDateEnd: endStr,
      });
    }

    // ── Build Employee[] from employeeDataSet ──
    const employeeMap = new Map<string, Employee>();
    for (const id of employeeDS.sortedRecordIds) {
      const rec = employeeDS.records[id];

      const empId =
        (rec.getValue("empId") as string) ?? "";
      const empName =
        (rec.getValue("empName") as string) ?? "";
      const strEmployeeNumber =
        (rec.getValue("strEmployeeNumber") as string) ?? "";

      if (empId && !employeeMap.has(empId)) {
        employeeMap.set(empId, {
          id: empId,
          name: empName,
          strEmployeeNumber,
        });
      }
    }

    // Sort employees alphabetically
    const employees = Array.from(employeeMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // ── Build vacationMap from vacationDataSet (current year only) ──
    const currentYear = new Date().getFullYear();
    const vacationMap: Record<string, VacationEntry> = {};
    for (const id of vacationDS.sortedRecordIds) {
      const rec = vacationDS.records[id];

      const vacEmpId =
        (rec.getValue("vacEmployeeId") as string) ?? "";
      const vacYear =
        (rec.getValue("vacYear") as number) ?? 0;
      const allowanceDays =
        (rec.getValue("vacAllowanceDays") as number) ?? 0;
      const carriedOver =
        (rec.getValue("vacCarriedOverDays") as number) ?? 0;

      if (vacYear === currentYear && vacEmpId && !vacationMap[vacEmpId]) {
        vacationMap[vacEmpId] = {
          employeeId: vacEmpId,
          year: vacYear,
          allowanceDays,
          carriedOver,
          totalQuota: allowanceDays + carriedOver,
        };
      }
    }

    // Container dimensions
    const width = context.mode.allocatedWidth;
    const height = context.mode.allocatedHeight;

    // Interaction callback — sets output properties and notifies Power Apps
    const onInteraction = (payload: InteractionPayload): void => {
      this.selectedEmployeeId = payload.employeeId;
      this.selectedStartDate = payload.startDate;
      this.selectedEndDate = payload.endDate;
      this.selectedAbsenceType = payload.absenceType;
      this.selectedAction = payload.action;
      this.selectedRecordId = payload.recordId;
      // Always-unique token: guarantees OnChange fires for repeated same-action
      // events (e.g. user adds two "Urlaub" entries back-to-back).
      this.selectedEventId = Date.now().toString();
      this.notifyOutputChanged();
    };

    const props: IAbsenceCalendarProps = {
      employees,
      absences,
      vacationMap,
      width,
      height,
      onInteraction,
    };

    this.lastElement = React.createElement(AbsenceCalendar, props);
    return this.lastElement;
  }

  public getOutputs(): IOutputs {
    return {
      selectedEmployeeId: this.selectedEmployeeId,
      selectedStartDate: this.selectedStartDate,
      selectedEndDate: this.selectedEndDate,
      selectedAbsenceType: this.selectedAbsenceType,
      selectedAction: this.selectedAction,
      selectedRecordId: this.selectedRecordId,
      selectedEventId: this.selectedEventId,
    };
  }

  public destroy(): void {
    // Cleanup
  }
}