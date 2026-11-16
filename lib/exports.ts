import { toast } from '@/components/ui-ua/toast';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
type CellValue = string | number | null | undefined;

/**
 * Spreadsheet apps run cells starting with = + - @ (or tab/CR) as formulas.
 * Prefix them with ' so a student name like "=HYPERLINK(...)" stays plain text.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(headers: string[], rows: CellValue[][], filename: string) {
  const escape = (val: CellValue) => `"${neutralizeFormula(String(val ?? '')).replace(/"/g, '""')}"`;
  const csv = '﻿' + [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/**
 * Writes a real .xlsx file: bold header row, columns sized to their content,
 * numbers kept as numbers so Excel can sort and average them.
 * The library is loaded only when someone actually exports.
 */
export async function downloadExcel(headers: string[], rows: CellValue[][], filename: string, sheetName = 'Report') {
  const { default: writeExcelFile } = await import('write-excel-file/browser');

  const headerRow = headers.map(h => ({ value: h, fontWeight: 'bold' as const, backgroundColor: '#F4B400' }));
  const dataRows = rows.map(row =>
    row.map(val => {
      if (typeof val === 'number' && Number.isFinite(val)) return { value: val };
      if (val === null || val === undefined || val === '') return null;
      // Excel stores these as text cells, so formulas are never evaluated
      return { value: String(val), type: String, wrap: String(val).length > 60 };
    })
  );

  const columns = headers.map((h, i) => {
    const longest = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { width: Math.min(60, Math.max(10, longest + 2)) };
  });

  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  const sheet = sheetName.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Report';
  await writeExcelFile([headerRow, ...dataRows], { columns, sheet }).toFile(filename);
}

/** Downloads in the chosen spreadsheet format. */
export async function downloadTable(format: 'csv' | 'xlsx', headers: string[], rows: CellValue[][], baseFilename: string, sheetName?: string) {
  if (format === 'xlsx') await downloadExcel(headers, rows, `${baseFilename}.xlsx`, sheetName);
  else downloadCSV(headers, rows, `${baseFilename}.csv`);
}

interface FacultyReportProps {
  professor: {
    name: string;
    email: string;
    level: string;
    department: string;
  };
  academicYear: string;
  semester: string;
  scoreCache: any;
  clusterScores: any[];
  sectionScores: any[];
  commentsList: string[];
}

const pct = (v: unknown) => (v !== null && v !== undefined ? `${v}%` : 'N/A');

function facultyReportRows({ professor, academicYear, semester, scoreCache, clusterScores, sectionScores, commentsList }: FacultyReportProps) {
  const rows: CellValue[][] = [
    ['Professor Name', professor.name],
    ['Email', professor.email],
    ['Level', professor.level],
    ['Department', professor.department],
    ['Academic Year', academicYear],
    ['Semester', semester],
    ['Composite Score', pct(scoreCache?.compositeScore)],
    ['Scale Score', pct(scoreCache?.scaleScore)],
    ['AI Sentiment Score', pct(scoreCache?.aiQualityScore)],
  ];
  (clusterScores || []).forEach((c: any) => rows.push([`${c.title || c.subject} Avg`, pct(c.score)]));
  (sectionScores || []).forEach((s: any) => rows.push([`Section ${s.name ?? s.sectionName ?? ''} Avg`, pct(s.score)]));
  (commentsList || []).forEach((c, i) => rows.push([`Comment ${i + 1}`, c]));
  return rows;
}

function facultyFilename(p: FacultyReportProps) {
  return `faculty_report_${p.professor.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${p.academicYear}_${p.semester}`.replace(/[^\w-]/g, '_');
}

export async function exportFacultyReport(format: 'csv' | 'xlsx', props: FacultyReportProps) {
  try {
    await downloadTable(format, ['Metric', 'Value'], facultyReportRows(props), facultyFilename(props), 'Faculty Report');
    toast.success(`${format === 'xlsx' ? 'Excel' : 'CSV'} exported successfully!`);
  } catch (err) {
    console.error(err);
    toast.error(`Failed to export ${format === 'xlsx' ? 'Excel' : 'CSV'}.`);
  }
}

/** Kept for existing callers. */
export function exportFacultyCSV(props: FacultyReportProps) {
  return exportFacultyReport('csv', props);
}

interface ExportPDFProps {
  professor: {
    id: string;
    name: string;
  };
  academicYear: string;
  semester: string;
}

export async function exportFacultyPDF({
  professor,
  academicYear,
  semester,
}: ExportPDFProps) {
  const toastId = toast.loading("Generating vector PDF report...");
  try {
    const query = new URLSearchParams({
      academicYear,
      semester,
    }).toString();

    // Redirect browser to trigger headless-Chrome PDF download API endpoint
    window.location.href = `/api/faculty/${professor.id}/pdf?${query}`;

    toast.success("PDF export started!", undefined, { id: toastId });
  } catch (err) {
    console.error(err);
    toast.error("Failed to export PDF.", undefined, { id: toastId });
  }
}
