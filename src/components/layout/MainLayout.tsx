import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Sidebar />
      <main>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
