import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-neutral-800 lg:bg-neutral-950 lg:p-4">
      <div className="mb-4 text-lg font-bold text-neutral-100">台股健康儀表板</div>
      <nav className="flex flex-col gap-2 text-sm text-neutral-300">
        <Link href="/" className="rounded-lg px-4 py-2 transition-colors hover:bg-neutral-900 hover:text-neutral-100">
          儀表板
        </Link>
        <Link href="/watchlist" className="rounded-lg px-4 py-2 transition-colors hover:bg-neutral-900 hover:text-neutral-100">
          觀察清單
        </Link>
        <Link href="/reports" className="rounded-lg px-4 py-2 transition-colors hover:bg-neutral-900 hover:text-neutral-100">
          每日報告
        </Link>
      </nav>
    </aside>
  );
}
