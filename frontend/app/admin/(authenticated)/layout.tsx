import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminAuthProvider } from "@/lib/admin-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="flex min-h-screen bg-dash-bg text-dash-ink">
        <AdminSidebar />
        <main className="flex-1 px-5 py-8 md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </AdminAuthProvider>
  );
}
