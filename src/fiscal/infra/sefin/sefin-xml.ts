const PREFIXED = '\\w*:?';
const TAG = (name: string) => `${PREFIXED}?${name}\\b`;

export function extractTag(xml: string, localName: string): string | undefined {
  const re = new RegExp(`<${TAG(localName)}[^>]*>([\\s\\S]*?)</${TAG(localName)}>`);
  const match = re.exec(xml);
  if (!match) return undefined;
  return match[1].trim();
}

export function extractIntTag(xml: string, localName: string): string | undefined {
  const value = extractTag(xml, localName);
  if (value === undefined) return undefined;
  const digits = value.replace(/\D+/g, '');
  return digits || undefined;
}

export function hasElement(xml: string, localName: string): boolean {
  return new RegExp(`<${TAG(localName)}[\\s>]`).test(xml);
}

export function extractElementId(
  xml: string,
  localName: string,
  pattern: RegExp,
): string | undefined {
  const re = new RegExp(`<${TAG(localName)}[^>]*\\bId="([^"]+)"`);
  const match = re.exec(xml);
  if (!match) return undefined;
  const id = match[1];
  return pattern.test(id) ? id : undefined;
}
