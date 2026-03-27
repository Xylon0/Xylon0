const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(appTsxPath, 'utf8');

// 1. Replace lucide-react icons with emojis
const iconReplacements = {
  '<LogIn size={16} />': '🚪',
  '<LogIn size={14} />': '🚪',
  '<LogOut size={20} />': '🚪',
  '<Send size={20} />': '📤',
  '<User size={16} />': '👤',
  '<User size={20} />': '👤',
  '<Copy className="text-white drop-shadow-lg" size={32} />': '<span className="text-3xl">📋</span>',
  '<Sparkles size={14} />': '✨',
  '<Loader2 className="animate-spin" size={20} />': '⏳',
  '<ImageIcon size={48} strokeWidth={1} />': '<span className="text-5xl">🖼️</span>',
  '<ArrowRight size={24} />': '➡️',
  '<MessageSquare size={20} />': '💬',
  '<Trash2 size={14} />': '🗑️'
};

for (const [icon, emoji] of Object.entries(iconReplacements)) {
  content = content.split(icon).join(emoji);
}

// Remove lucide-react import
content = content.replace(/import \{[^}]+\} from "lucide-react";\n/, '');

// 2. Replace rounded corners with rounded-[12px]
content = content.replace(/rounded-3xl/g, 'rounded-[12px]');
content = content.replace(/rounded-2xl/g, 'rounded-[12px]');
content = content.replace(/rounded-xl/g, 'rounded-[12px]');
content = content.replace(/rounded-lg/g, 'rounded-[12px]');
content = content.replace(/rounded-\[24px\]/g, 'rounded-[12px]');
content = content.replace(/rounded-\[32px\]/g, 'rounded-[12px]');
// Keep rounded-full for circles

// 3. Remove gradients
// bg-gradient-to-X from-Y via-Z to-W -> bg-primary/5
content = content.replace(/bg-gradient-to-[a-z]+ from-[a-zA-Z0-9\-\/]+ via-[a-zA-Z0-9\-\/]+ to-[a-zA-Z0-9\-\/]+/g, 'bg-primary/5');
content = content.replace(/bg-gradient-to-[a-z]+ from-[a-zA-Z0-9\-\/]+ to-[a-zA-Z0-9\-\/]+/g, 'bg-primary/5');
content = content.replace(/bg-\[conic-gradient[^\]]+\]/g, 'bg-primary/10');
content = content.replace(/bg-\[radial-gradient[^\]]+\]/g, 'bg-primary/10');
content = content.replace(/radial-gradient\([^)]+\)/g, 'none');

// 4. Ensure spacing is multiples of 8 (Tailwind defaults are mostly fine, but let's check for arbitrary ones if any)
// p-5 -> p-4 (16px) or p-6 (24px). Let's do p-6
content = content.replace(/p-5/g, 'p-6');
content = content.replace(/gap-3/g, 'gap-4');
content = content.replace(/gap-5/g, 'gap-6');

fs.writeFileSync(appTsxPath, content, 'utf8');
console.log('Optimization complete.');
