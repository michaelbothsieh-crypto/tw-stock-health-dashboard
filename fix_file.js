const fs = require('fs');
const targetPath = 'src/app/api/stock/[ticker]/snapshot/route.ts';
let content = fs.readFileSync(targetPath, 'utf8');

// The file currently has a syntax error around line 510 where it says `} catch (error: unknown) {`
// Let's strip everything from the end of `finalPayload = { ... }` to the end of the file
// and replace it with the correct block closure.

const endIdx = content.indexOf('    // 寫入快取 (10分鐘)');
if (endIdx > -1) {
  content = content.substring(0, endIdx);
}

const correctEnd = `
      // 寫入快取 (10分鐘)
      await setCache(cacheKey, finalPayload, 600);
    } // end of cache miss

    return NextResponse.json(finalPayload);
  } catch (error: unknown) {
    console.error("Snapshot API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
`;

fs.writeFileSync(targetPath, content + correctEnd);
