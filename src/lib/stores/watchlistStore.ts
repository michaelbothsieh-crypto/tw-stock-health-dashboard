import { resolveStockName } from "../stocks/nameResolver";

export type WatchlistItem = {
  code: string;
  name: string;
};

type Listener = (items: WatchlistItem[]) => void;

class WatchlistStore {
  private items: WatchlistItem[] = [];
  private listeners: Set<Listener> = new Set();
  private initialized = false;
  private readonly STORAGE_KEY = "twshd:watchlist:v2";
  private readonly DEFAULT_CODES = ["2330", "2317", "2454", "2382", "3231"];

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === this.STORAGE_KEY) {
          this.loadFromStorage();
        }
      });
      // Initial load async
      setTimeout(() => this.init(), 0);
    }
  }

  private async init() {
    await this.loadFromStorage();
    this.initialized = true;
  }

  private async loadFromStorage() {
    let itemsToResolve: string[] = this.DEFAULT_CODES;
    
    try {
      const storedV2 = localStorage.getItem(this.STORAGE_KEY);
      const storedLegacyV2 = localStorage.getItem("watchlist_v2");
      const storedV1 = localStorage.getItem("watchlist");
      
      let needsMigration = false;
      let parsedData: any[] = [];
      
      if (storedV2) {
         parsedData = JSON.parse(storedV2);
      } else if (storedLegacyV2) {
         parsedData = JSON.parse(storedLegacyV2);
         needsMigration = true;
      } else if (storedV1) {
         const parsedOld = JSON.parse(storedV1);
         if (Array.isArray(parsedOld) && typeof parsedOld[0] === 'string') {
             itemsToResolve = parsedOld;
             needsMigration = true;
         }
      }
      
      if (parsedData.length > 0) {
         // We have v2 objects, but let's check if they contain English names
         let anyEnglish = false;
         for (const item of parsedData) {
             if (/[A-Za-z]{3,}/.test(item.name)) {
                 anyEnglish = true;
                 break;
             }
         }
         
         if (!anyEnglish && !needsMigration) {
             this.items = parsedData;
             this.notify();
             return;
         }
         
         if (parsedData[0]?.code) {
             itemsToResolve = parsedData.map(p => p.code);
         }
      }
    } catch (e) {}
    
    // Resolve names
    const newWatchlist = await Promise.all(
      itemsToResolve.map(async (code) => ({
        code,
        name: await resolveStockName(code),
      }))
    );
    
    this.items = newWatchlist;
    this.saveToStorage();
    this.notify();
  }

  private saveToStorage() {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener([...this.items]); // notify with fresh copy
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    if (this.initialized) {
      listener([...this.items]);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  getItems() {
    return this.items;
  }

  async add(code: string) {
    if (this.items.some((item) => item.code === code)) return;
    const name = await resolveStockName(code);
    this.items = [...this.items, { code, name }];
    this.saveToStorage();
    this.notify();
  }

  remove(code: string) {
    this.items = this.items.filter((item) => item.code !== code);
    this.saveToStorage();
    this.notify();
  }
}

export const watchlistStore = new WatchlistStore();
