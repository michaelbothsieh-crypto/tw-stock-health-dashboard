import Link from 'next/link';

export function Sidebar() {
  return (
    <div className="w-64 border-r bg-muted/30 h-screen p-4 flex flex-col gap-4">
      <div className="font-bold text-lg mb-4">台股波段儀表板</div>
      <nav className="flex flex-col gap-2">
        <Link href="/" className="px-4 py-2 hover:bg-muted rounded-md transition-colors">
          首頁儀表板
        </Link>
        <Link href="/watchlist" className="px-4 py-2 hover:bg-muted rounded-md transition-colors">
          自選股清單
        </Link>
        <Link href="/reports" className="px-4 py-2 hover:bg-muted rounded-md transition-colors">
          每日分析報告
        </Link>
      </nav>
    </div>
  );
}
