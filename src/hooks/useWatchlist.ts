"use client";

import { useState, useEffect, useCallback } from "react";
import { watchlistStore, WatchlistItem } from "@/lib/stores/watchlistStore";

/**
 * 封裝現有的 watchlistStore，確保戰情室與全站觀察清單狀態 100% 同步。
 */
export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    // 訂閱全局 Store 變動
    const unsubscribe = watchlistStore.subscribe((newItems) => {
      setItems(newItems);
    });
    return unsubscribe;
  }, []);

  const addStock = useCallback(async (ticker: string) => {
    await watchlistStore.add(ticker);
  }, []);

  const removeStock = useCallback((ticker: string) => {
    watchlistStore.remove(ticker);
  }, []);

  const hasStock = useCallback((ticker: string) => {
    return items.some(item => item.code === ticker);
  }, [items]);

  const toggleStock = useCallback(async (ticker: string) => {
    if (hasStock(ticker)) {
      removeStock(ticker);
    } else {
      await addStock(ticker);
    }
  }, [hasStock, addStock, removeStock]);

  return {
    watchlist: items.map(i => i.code), // 僅回傳代號陣列供 Map 使用
    items, // 完整物件陣列
    addStock,
    removeStock,
    hasStock,
    toggleStock
  };
}
