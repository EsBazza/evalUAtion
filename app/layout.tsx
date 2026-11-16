import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans-main",
  display: "swap",
});

export const metadata: Metadata = {
  title: "evalUAte - Faculty Evaluation System",
  description: "University of the Assumption Faculty Evaluation System",
  icons: {
    icon: [
      { url: "/favicon_logo.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon_logo.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon_logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/favicon_logo.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
