import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitFox Foundation",
  description: "FitFox Epic 1 API foundation"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
