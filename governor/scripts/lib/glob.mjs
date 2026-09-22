export function globToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') { out += '.*'; i++; if (pattern[i + 1] === '/') i++; }
      else out += '[^/]*';
    } else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + out + '$');
}

export function matchGlob(pattern, value) {
  if (typeof pattern !== 'string' || typeof value !== 'string') return false;
  if (!pattern.includes('*') && !pattern.includes('?')) return pattern === value;
  return globToRegExp(pattern).test(value);
}

export function matchAny(patterns, value) {
  return Array.isArray(patterns) && patterns.some((p) => matchGlob(p, value));
}
