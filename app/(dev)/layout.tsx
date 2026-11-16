import { notFound } from 'next/navigation';

// Developer-only pages (component previews). Hidden in production builds.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
