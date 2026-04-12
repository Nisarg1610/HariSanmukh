const fs = require('fs');
let text = fs.readFileSync('src/app/page.tsx', 'utf8');

// Replace the SEVA emoji
text = text.replace(/<span className="text-lg">[^<]*<\/span>/, '<span className="text-lg">🙏</span>');

// Replace the Garbage emoji
text = text.replace(/<span className="text-4xl block mb-3 opacity-60">[^<]*<\/span>/, '<span className="text-4xl block mb-3 opacity-60">🗑️</span>');

// Replace potentially other broken cases like the greeting (if still somehow broken)
text = text.replace(/<p className=\"text-2xl font-bold mb-1 tracking-wide\">[\s\S]*?<\/p>/, '<p className=\"text-2xl font-bold mb-1 tracking-wide\">\n            🙏 Jay Swaminarayan 🙏\n          </p>');

fs.writeFileSync('src/app/page.tsx', text, 'utf8');
console.log('Fixed Seva and Garbage emojis');
