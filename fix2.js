const fs = require('fs');
let buf = fs.readFileSync('src/app/page.tsx', 'utf8');
buf = buf.replace(/<p className=\"text-2xl font-bold mb-1 tracking-wide\">[\s\S]*?<\/p>/, '<p className=\"text-2xl font-bold mb-1 tracking-wide\">\n            🙏 Jay Swaminarayan 🙏\n          </p>');
fs.writeFileSync('src/app/page.tsx', buf, 'utf8');
console.log('Fixed Jay Swaminarayan emoji');
