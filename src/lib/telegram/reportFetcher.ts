import fs from "fs";
import path from "path";

function readLatestLocalReport() {
  try {
    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) return null;

    const files = fs
      .readdirSync(reportsDir)
      .filter((name) => name.endsWith("-watchlist.json"))
      .sort((a, b) => b.localeCompare(a));

    if (files.length === 0) return null;

    const latestPath = path.join(reportsDir, files[0]);
    const raw = fs.readFileSync(latestPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchLatestReport() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.REPORT_BRANCH || "main";

  if (!owner || !repo) {
    const local = readLatestLocalReport();
    if (local) return local;
    throw new Error("Missing GITHUB_OWNER or GITHUB_REPO in ENV, and no local reports found");
  }

  // Fetch directory listing
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/reports?ref=${branch}`;
  
  // Note: For public repos we don't strictly need a token, 
  // but if it's private, GITHUB_TOKEN (Personal Access Token) is required.
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Telegram-Bot-Webhook"
  };

  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl, { headers, next: { revalidate: 60 } }); // Next.js cache for 60s
  if (!res.ok) {
    if (res.status === 404) {
      const local = readLatestLocalReport();
      if (local) return local;
      return null;
    }
    const local = readLatestLocalReport();
    if (local) return local;
    throw new Error(`GitHub API Error: ${res.statusText}`);
  }

  const files: any[] = await res.json();
  
  // Find all json files
  const jsonFiles = files.filter(f => f.name.endsWith("-watchlist.json"));
  if (jsonFiles.length === 0) {
    const local = readLatestLocalReport();
    if (local) return local;
    return null;
  }

  // Sort descending by name (YYYY-MM-DD)
  jsonFiles.sort((a, b) => b.name.localeCompare(a.name));
  const latestFile = jsonFiles[0];

  // Fetch the raw content
  const rawRes = await fetch(latestFile.download_url, { headers, next: { revalidate: 60 } });
  if (!rawRes.ok) {
    const local = readLatestLocalReport();
    if (local) return local;
    throw new Error(`Failed to download raw json: ${rawRes.statusText}`);
  }

  const data = await rawRes.json();
  return data;
}
