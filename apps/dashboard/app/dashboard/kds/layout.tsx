export default function KDSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0A0A0F]">
      {children}
    </div>
  );
}
