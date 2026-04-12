const fs = require('fs');
const files = ['src/app/page.tsx', 'src/app/layout.tsx', 'src/components/SplashScreen.tsx', 'src/components/AppHeader.tsx'];
const replacements = {
  'ðŸ™': '🙏',
  'ðŸ‘‹': '👋',
  'ðŸ”—': '🔗',
  'ðŸ“–': '📖',
  'ðŸ‘•': '👕',
  'ðŸ—‘ï¸ ': '🗑️',
  'ðŸ””': '🔔',
  'â”€': '─'
};
files.forEach(f => {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    for (const [bad, good] of Object.entries(replacements)) {
      text = text.split(bad).join(good);
    }
    fs.writeFileSync(f, text, 'utf8');
    console.log('Fixed', f);
  }
});
