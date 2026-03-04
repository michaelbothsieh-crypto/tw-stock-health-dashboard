const fs = require('fs');
const targetPath = 'src/app/api/stock/[ticker]/snapshot/route.ts';
let content = fs.readFileSync(targetPath, 'utf8');

const lastReturnIdx = content.lastIndexOf('return NextResponse.json({');
if (lastReturnIdx !== -1 && lastReturnIdx > content.length - 2000) {
  content = content.substring(0, lastReturnIdx) + 'const finalPayload = {' + content.substring(lastReturnIdx + 26);
  fs.writeFileSync(targetPath, content);
  console.log("Fixed return");
} else {
  console.log("Could not find the target return", lastReturnIdx);
}
