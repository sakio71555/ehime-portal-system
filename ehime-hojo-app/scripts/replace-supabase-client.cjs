const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(process.cwd(), 'src');
const CLIENT_FILE = path.join(SRC_DIR, 'lib', 'supabaseClient.js');

const targetExtensions = new Set(['.js', '.jsx']);

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...walk(fullPath));
    } else if (targetExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const toImportPath = (fromFile) => {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, CLIENT_FILE);

  rel = rel.replace(/\\/g, '/').replace(/\.js$/, '');

  if (!rel.startsWith('.')) {
    rel = `./${rel}`;
  }

  return rel;
};

const removeCreateClientImport = (code) => {
  return code.replace(
    /^\s*import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"];\s*\n?/gm,
    ''
  );
};

const removeSupabaseEnvBlock = (code) => {
  let next = code;

  next = next.replace(
    /^\s*const\s+supabaseUrl\s*=\s*import\.meta\.env\.VITE_SUPABASE_URL(?:\?\.?trim\(\))?;\s*\n?/gm,
    ''
  );

  next = next.replace(
    /^\s*const\s+supabaseAnonKey\s*=\s*import\.meta\.env\.VITE_SUPABASE_ANON_KEY(?:\?\.?trim\(\))?;\s*\n?/gm,
    ''
  );

  next = next.replace(
    /^\s*const\s+supabase\s*=\s*(?:[\s\S]*?createClient\s*\(\s*supabaseUrl\s*,\s*supabaseAnonKey\s*\)[\s\S]*?);\s*\n?/m,
    ''
  );

  return next;
};

const hasSupabaseClientImport = (code) => {
  return /from\s+['"].*\/lib\/supabaseClient['"]/.test(code);
};

const insertSupabaseImport = (code, importPath) => {
  if (hasSupabaseClientImport(code)) return code;

  const importLine = `import { supabase } from '${importPath}';\n`;

  const importMatches = [...code.matchAll(/^import[\s\S]*?;\s*$/gm)];

  if (importMatches.length === 0) {
    return `${importLine}${code}`;
  }

  const lastImport = importMatches[importMatches.length - 1];
  const insertAt = lastImport.index + lastImport[0].length;

  return `${code.slice(0, insertAt)}\n${importLine}${code.slice(insertAt)}`;
};

const normalizeBlankLines = (code) => {
  return code
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^\s*\n/, '');
};

const files = walk(SRC_DIR);

let changedCount = 0;

for (const file of files) {
  if (path.resolve(file) === path.resolve(CLIENT_FILE)) {
    continue;
  }

  const original = fs.readFileSync(file, 'utf8');

  if (!original.includes('@supabase/supabase-js') && !original.includes('createClient')) {
    continue;
  }

  let next = original;

  next = removeCreateClientImport(next);
  next = removeSupabaseEnvBlock(next);

  const importPath = toImportPath(file);
  next = insertSupabaseImport(next, importPath);
  next = normalizeBlankLines(next);

  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    changedCount += 1;
    console.log(`updated: ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`\nDone. Updated ${changedCount} file(s).`);
console.log('Note: src/lib/supabaseClient.js should still contain createClient.');