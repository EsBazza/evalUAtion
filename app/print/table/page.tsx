import { getFacultyRankings, getEvaluationAttendanceLogsForExport } from '@/app/actions/admin';
import { getAuditLogs } from '@/app/actions/audit';
import { notFound } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{
    type?: 'ratings' | 'attendance' | 'audit';
    search?: string;
    depts?: string;
    subjects?: string;
    sections?: string;
    academicYear?: string;
    semester?: string;
    scope?: string;
    deptId?: string;
    years?: string;
    sems?: string;
    allFields?: string;
    sortBy?: string;
    sortDirection?: string;
  }>;
}

export default async function PrintTablePage({ searchParams }: PageProps) {
  const search = await searchParams;
  const type = search.type;
  if (!type || !['ratings', 'attendance', 'audit'].includes(type)) {
    notFound();
  }

  const querySearch = search.search || '';

  // 1. Fetch & filter data based on print type
  let title = '';
  let headers: string[] = [];
  let rows: string[][] = [];

  if (type === 'ratings') {
    title = 'Faculty Performance Ratings Ledger';
    headers = ["Faculty Name", "Email Address", "Department", "Assigned Sections", "Score"];
    
    const academicYear = search.academicYear || '';
    const semester = search.semester || '';
    const rawRankings = await getFacultyRankings(academicYear, semester);
    
    // Apply exact same filters as page.tsx
    const deptsArr = search.depts ? search.depts.split(',') : [];
    const subjectsArr = search.subjects ? search.subjects.split(',') : [];
    const sectionsArr = search.sections ? search.sections.split(',') : [];
    const searchVal = querySearch.toLowerCase().trim();

    const filteredRankings = rawRankings.filter(r => {
      const searchMatch = !searchVal || 
        (r.name || '').toLowerCase().includes(searchVal) ||
        (r.email || '').toLowerCase().includes(searchVal);
      const deptMatch = deptsArr.length === 0 || deptsArr.includes(r.department);
      const subjectMatch = subjectsArr.length === 0 || (r.teachingAssignments && r.teachingAssignments.some((ta: any) => subjectsArr.includes(ta.subjectName)));
      const sectionMatch = sectionsArr.length === 0 || (r.teachingAssignments && r.teachingAssignments.some((ta: any) => sectionsArr.includes(ta.sectionName)));
      return searchMatch && deptMatch && subjectMatch && sectionMatch;
    });

    rows = filteredRankings.map(r => [
      r.name || 'Not Set',
      r.email || '',
      r.department || 'N/A',
      r.sections || 'None',
      r.averageScore !== null ? `${r.averageScore.toFixed(1)}%` : 'N/A'
    ]);
  } else if (type === 'attendance') {
    title = 'Evaluation Attendance Logs';
    const isAllFields = search.allFields === 'true';
    headers = isAllFields 
      ? ["Student Name", "Email", "First Submitted", "Most Recent Submitted", "Department", "Section"]
      : ["Student Name", "Email", "Section"];

    const scope = search.scope || 'current';
    const deptId = search.deptId || '';
    
    let rawLogs = [];
    if (scope === 'current') {
      rawLogs = await getEvaluationAttendanceLogsForExport({
        search: querySearch,
        departments: search.depts ? search.depts.split(',') : [],
        sections: search.sections ? search.sections.split(',') : [],
        academicYears: search.years ? search.years.split(',') : [],
        semesters: search.sems ? search.sems.split(',') : []
      });
    } else {
      rawLogs = await getEvaluationAttendanceLogsForExport({
        departments: [deptId]
      });
    }

    rows = rawLogs.map(r => {
      if (isAllFields) {
        return [
          r.studentName || 'Not Set',
          r.studentEmail,
          new Date(r.firstSubmitted).toLocaleString(),
          new Date(r.mostRecentSubmitted).toLocaleString(),
          r.departmentName || 'N/A',
          r.sectionName || 'N/A'
        ];
      } else {
        return [
          r.studentName || 'Not Set',
          r.studentEmail,
          r.sectionName || 'N/A'
        ];
      }
    });
  } else if (type === 'audit') {
    title = 'System Audit Logs';
    headers = ["Timestamp", "Event Type", "Description", "Actor"];
    
    const audits = await getAuditLogs(200);
    const sortBy = search.sortBy || 'date';
    const sortDirection = search.sortDirection || 'desc';
    const searchVal = querySearch.toLowerCase().trim();

    const filteredAndSortedLogs = [...audits]
      .filter(log => {
        const eventType = (log.eventType || '').toLowerCase();
        const actor = (log.actorEmail || '').toLowerCase();
        const desc = (log.details?.desc || log.details?.message || JSON.stringify(log.details) || '').toLowerCase();
        return eventType.includes(searchVal) || actor.includes(searchVal) || desc.includes(searchVal);
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          comparison = timeA - timeB;
        } else if (sortBy === 'type') {
          const valA = (a.eventType || '').toLowerCase();
          const valB = (b.eventType || '').toLowerCase();
          comparison = valA.localeCompare(valB);
        } else if (sortBy === 'actor') {
          const valA = (a.actorEmail || '').toLowerCase();
          const valB = (b.actorEmail || '').toLowerCase();
          comparison = valA.localeCompare(valB);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });

    rows = filteredAndSortedLogs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.eventType || '',
      log.details?.desc || log.details?.message || JSON.stringify(log.details) || '',
      log.actorEmail || ''
    ]);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');

        /* Print formatting */
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #1e293b !important;
            font-family: 'Inter', sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Watermark pseudo-element overlay on every printed page */
          body::before {
            content: "" !important;
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 500px !important;
            height: 500px !important;
            background-image: url('/ua-logo.png') !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            background-size: contain !important;
            opacity: 0.055 !important;
            z-index: -1000 !important;
            pointer-events: none !important;
          }

          /* Prevent page cutoffs */
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          /* Force colors to print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        body {
          background-color: #ffffff;
          font-family: 'Inter', sans-serif;
        }
      `}} />
      <div className="relative min-h-screen bg-white text-slate-800 p-6 max-w-[800px] mx-auto print:p-0">
        {/* Watermark Logo (Centered overlay, repeated on every printed page via CSS fixed position, pointer-events-none so it doesn't block interactions/selections) */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-[9999] opacity-[0.035] print:opacity-[0.035]">
          <img 
            src="/ua-logo.png" 
            alt="UA Seal Watermark" 
            className="w-[520px] h-[520px] object-contain animate-fade-in"
          />
        </div>
        
        {/* Title Details */}
        <div className="border-b border-slate-200 pb-2 mb-6">
          <h2 className="text-xl font-bold font-serif text-[#0B2F64] uppercase tracking-wide">
            {title}
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
            Export Type: {type.toUpperCase()} Ledger · Filtered Records: {rows.length}
          </p>
        </div>

        {/* Ledger Table Container */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B2F64] text-white text-[10px] uppercase tracking-wider font-bold border-b-2 border-[#D4AF37]">
                {headers.map((h, i) => (
                  <th 
                    key={i} 
                    className={`p-3.5 ${i === 0 ? 'pl-6' : ''} ${i === headers.length - 1 ? 'pr-6 text-right' : ''} ${i === 0 ? 'text-[#D4AF37]' : 'text-white'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-medium">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="text-center py-10 text-slate-400 italic font-semibold">
                    No matching records found to export.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/40 odd:bg-slate-50/15">
                    {row.map((cell, cellIdx) => (
                      <td 
                        key={cellIdx} 
                        className={`p-3 ${cellIdx === 0 ? 'pl-6 font-bold text-slate-900' : 'text-slate-700'} ${cellIdx === row.length - 1 ? 'pr-6 text-right font-bold' : ''}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
