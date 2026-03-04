import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "Expenseflow",
  description: "Expense management dashboard"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}

