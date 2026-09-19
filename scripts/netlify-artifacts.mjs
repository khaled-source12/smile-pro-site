export function fixedRedirectRules(config) {
  return config.split('[[redirects]]').slice(1).map((block) => {
    const from = block.match(/\bfrom\s*=\s*"([^"]+)"/)?.[1];
    const to = block.match(/\bto\s*=\s*"([^"]+)"/)?.[1];
    const status = block.match(/\bstatus\s*=\s*(\d+)/)?.[1];
    const language = block.match(/query\s*=\s*\{\s*lang\s*=\s*"([^"]+)"\s*\}/)?.[1];
    if (!from || !to || !status) throw new Error('Unsupported Netlify redirect block');
    return `${from}${language ? ` lang=${language}` : ''} ${to} ${status}${/\bforce\s*=\s*true/.test(block) ? '!' : ''}`;
  });
}
