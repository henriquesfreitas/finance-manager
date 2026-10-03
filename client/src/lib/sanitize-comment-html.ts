const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'i', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong',
  'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]);

const DROP_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math']);

function isSafeUrl(value: string, allowMailto: boolean): boolean {
  try {
    const url = new URL(value, document.baseURI);
    return url.protocol === 'http:' || url.protocol === 'https:' || (allowMailto && url.protocol === 'mailto:');
  } catch {
    return false;
  }
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

function markdownCellHtml(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      record.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && content[index + 1] === '\n') index += 1;
      record.push(cell.trim());
      if (record.some((field) => field.length > 0)) records.push(record);
      record = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  record.push(cell.trim());
  if (record.some((field) => field.length > 0)) records.push(record);
  return records;
}

function csvTableHtml(content: string): string | null {
  const records = parseCsvRecords(content);
  if (records.length < 2 || records[0].length < 3) return null;
  if (!records.every((record) => record.length === records[0].length)) return null;

  const headers = records[0].map((cell) => `<th>${markdownCellHtml(cell)}</th>`).join('');
  const rows = records.slice(1).map((record) => (
    `<tr>${record.map((cell) => `<td>${markdownCellHtml(cell)}</td>`).join('')}</tr>`
  )).join('');
  return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Converts pasted CSV or Markdown pipe tables before the common HTML sanitizer runs. */
function convertPastedTables(content: string): string {
  const csvTable = csvTableHtml(content);
  if (csvTable) return csvTable;

  const lines = content.split(/\r?\n/);
  const output: string[] = [];

  for (let index = 0; index < lines.length;) {
    if (index + 2 >= lines.length || !lines[index].includes('|') || !lines[index + 1].includes('|')) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const headers = splitMarkdownRow(lines[index]);
    const separators = splitMarkdownRow(lines[index + 1]);
    const isSeparator = separators.length === headers.length
      && separators.every((cell) => /^:?-{3,}:?$/.test(cell));
    if (!isSeparator || !lines[index + 2].includes('|')) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const rows: string[][] = [];
    let rowIndex = index + 2;
    while (rowIndex < lines.length && lines[rowIndex].includes('|')) {
      rows.push(splitMarkdownRow(lines[rowIndex]));
      rowIndex += 1;
    }

    const headerHtml = headers.map((cell) => `<th>${markdownCellHtml(cell)}</th>`).join('');
    const rowsHtml = rows.map((row) => `<tr>${headers.map((_, cellIndex) => (
      `<td>${markdownCellHtml(row[cellIndex] ?? '')}</td>`
    )).join('')}</tr>`).join('');
    output.push(`<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`);
    index = rowIndex;
  }

  return output.join('\n');
}

function copySafeNode(node: Node, target: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(node.textContent ?? ''));
    return;
  }

  if (!(node instanceof Element)) return;
  const tag = node.tagName.toLowerCase();
  if (DROP_CONTENT_TAGS.has(tag)) return;

  if (!ALLOWED_TAGS.has(tag)) {
    node.childNodes.forEach((child) => copySafeNode(child, target));
    return;
  }

  const clean = document.createElement(tag);
  if (tag === 'a') {
    const href = node.getAttribute('href');
    if (href && isSafeUrl(href, true)) clean.setAttribute('href', href);
    const title = node.getAttribute('title');
    if (title) clean.setAttribute('title', title);
    if (node.getAttribute('target') === '_blank') {
      clean.setAttribute('target', '_blank');
      clean.setAttribute('rel', 'noopener noreferrer');
    }
  }

  node.childNodes.forEach((child) => copySafeNode(child, clean));
  target.appendChild(clean);
}

/** Returns comment markup with formatting tags preserved and active content removed. */
export function sanitizeCommentHtml(content: string): string {
  const parsed = new DOMParser().parseFromString(convertPastedTables(content), 'text/html');
  const safeContainer = document.createElement('div');
  parsed.body.childNodes.forEach((node) => copySafeNode(node, safeContainer));
  return safeContainer.innerHTML;
}
