import FacultyPreviewClient from './FacultyPreviewClient';

interface PageProps {
  params: Promise<{ professorId: string }>;
}

export default async function AdminFacultyPreviewPage({ params }: PageProps) {
  const { professorId } = await params;
  return <FacultyPreviewClient professorId={professorId} />;
}
