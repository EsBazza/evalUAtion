import { auth } from '@/auth';
import StudentEvaluateClient from './StudentEvaluateClient';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();
  if (!session || !session.user?.email) {
    redirect('/api/auth/signin');
  }

  return <StudentEvaluateClient studentEmail={session.user.email} studentName={session.user.name || undefined} />;
}
