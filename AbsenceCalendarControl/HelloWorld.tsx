import * as React from "react";

export interface AbsenceRecord {
  employeeName: string;
  employeeId: string;
  absenceType: string;
  startDate: string;
  endDate: string;
}

export interface IAbsenceTableProps {
  records: AbsenceRecord[];
}

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontFamily: "Segoe UI, sans-serif",
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "8px 12px",
  backgroundColor: "#f0f0f0",
  textAlign: "left",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "6px 12px",
};

export const AbsenceTable: React.FC<IAbsenceTableProps> = ({ records }) => {
  if (records.length === 0) {
    return <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>No records found.</div>;
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Employee Name</th>
          <th style={thStyle}>Employee ID</th>
          <th style={thStyle}>Absence Type</th>
          <th style={thStyle}>Start Date</th>
          <th style={thStyle}>End Date</th>
        </tr>
      </thead>
      <tbody>
        {records.map((r, i) => (
          <tr key={i}>
            <td style={tdStyle}>{r.employeeName}</td>
            <td style={tdStyle}>{r.employeeId}</td>
            <td style={tdStyle}>{r.absenceType}</td>
            <td style={tdStyle}>{r.startDate}</td>
            <td style={tdStyle}>{r.endDate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
