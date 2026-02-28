import Link from "next/link";
import { LayoutDashboard, FileText, Search, Star } from "lucide-react";
import { VisitorStats } from "@/components/ui/VisitorStats";

export function Sidebar() {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-neutral-800 lg:bg-neutral-950 lg:p-4">
      <div className="flex-1">
        <div className="mb-8 flex items-center gap-2 px-4 text-xl font-black tracking-tighter text-neutral-100">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          台股診斷 PRO
        </div>
        <nav className="flex flex-col gap-1.5 text-sm font-bold text-neutral-400">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-white/5 hover:text-neutral-100">
            <Search className="h-4 w-4" />
            個股診斷
          </Link>
          <Link href="/watchlist" className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-white/5 hover:text-neutral-100">
            <LayoutDashboard className="h-4 w-4" />
            AI 健康戰情室
          </Link>
          <Link href="/reports" className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-white/5 hover:text-neutral-100">
            <FileText className="h-4 w-4" />
            AI 分析報告
          </Link>
        </nav>
      </div>
      
      <div className="mt-auto pt-4 border-t border-neutral-800/50 px-2">
        <VisitorStats />
      </div>
    </aside>
  );
}
