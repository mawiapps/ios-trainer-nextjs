import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "iOS Trainer",
  description: "Cursos interactivos de iOS, de cero a arquitecto / Interactive iOS courses, from zero to architect",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <LocaleProvider>
          <div className="shell">
            <Sidebar />
            <main className="main">{children}</main>
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
