import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | RSS Reader",
  description: "Configure AI summarization and sync settings",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
