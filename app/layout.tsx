import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ProfileGate from "@/components/ProfileGate";
import { LocaleProvider } from "@/lib/i18n";
import { ProgressProvider } from "@/lib/progress";

export const metadata: Metadata = {
  title: "iOS Trainer",
  description: "Módulos interactivos de iOS, de cero a arquitecto / Interactive iOS modules, from zero to architect",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <LocaleProvider>
          <ProgressProvider>
            <ProfileGate>
              <div className="shell">
                <Sidebar />
                <main className="main">{children}</main>
              </div>
            </ProfileGate>
          </ProgressProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
