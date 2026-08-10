import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In · Dineiz Dashboard",
  description: "Sign in to the Dineiz Enterprise Restaurant Management Platform",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex w-full"
      style={{ background: "#ffffff", fontFamily: "'Inter', sans-serif" }}
    >
      {children}
    </div>
  );
}
