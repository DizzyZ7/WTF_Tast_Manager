import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WTF",
  description: "Work Task Flow",
};

/**
 * Корневой layout приложения.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
