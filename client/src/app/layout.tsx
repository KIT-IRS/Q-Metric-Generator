import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-Metrics Generator",
  description:
    "Interactive Editor for Q-Metrics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
