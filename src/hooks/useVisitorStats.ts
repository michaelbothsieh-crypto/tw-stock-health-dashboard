import { useState, useEffect } from "react";

export function useVisitorStats() {
  const [stats, setStats] = useState({ onlineUsers: 0, totalVisitors: 0 });

  useEffect(() => {
    // 1. Get or create sessionId
    let sessionId = localStorage.getItem("visitor_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("visitor_session_id", sessionId);
    }

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats/visitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        // Silent failure
      }
    };

    // Initial fetch
    fetchStats();

    // Polling every 1 minute
    const interval = setInterval(fetchStats, 60000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}
