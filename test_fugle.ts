import https from "https";

https.get("https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/2344", {
  headers: { "X-API-KEY": "DUMMY_KEY" }
}, (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Body:", data);
  });
}).on("error", (e) => {
  console.error("Error:", e);
});
