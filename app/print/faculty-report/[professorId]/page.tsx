import { getFacultyProfileData } from '@/app/actions/management';
import FacultyPrintClient from './FacultyPrintClient';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ professorId: string }>;
  searchParams: Promise<{
    academicYear?: string;
    semester?: string;
    subjectId?: string;
  }>;
}

export default async function FacultyReportPrintPage({ params, searchParams }: PageProps) {
  const { professorId } = await params;
  const search = await searchParams;

  const academicYear = search.academicYear || '';
  const semester = search.semester || '';
  const subjectId = search.subjectId || 'all';

  // Fetch all necessary data server-side
  const data = await getFacultyProfileData(professorId, academicYear, semester, subjectId);
  if (!data || !data.professor) {
    notFound();
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');

        /* Print styling rules */
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #1e293b !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 11px !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Watermark logo positioned behind the page content on every page */
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
          
          /* Prevent page cutoffs inside components */
          .print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 20px !important;
            background-color: transparent !important;
            background: transparent !important;
          }
          
          /* Force colors to output */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        /* General rules for rendering engine */
        body {
          background-color: #ffffff;
          font-family: 'Inter', sans-serif;
        }
      `}} />
      <FacultyPrintClient 
        data={data} 
        academicYear={academicYear || '2026-2027'} 
        semester={semester || '1st'} 
      />
    </>
  );
}
