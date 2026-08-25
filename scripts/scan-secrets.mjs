import fs from 'node:fs';

const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;
const PLACEHOLDER = /^(?:\[?redacted\]?|example|sample|dummy|changeme|password|secret|token|test(?:[-_].*)?|your[-_].*|<.*>|\$\{.*\})$/i;

const rules = [
  {
    name: 'private-key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'github-token',
    pattern: /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    name: 'credential-uri',
    pattern: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s:/]+:[^\s@/]+@/i,
  },
  {
    name: 'aws-access-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
];

const assignmentPattern = /\b(password|senha|passwd|pwd|api[_-]?key|secret|token)\s*[:=]\s*(["'`])([^"'`]+)\2/gi;

function inputFiles() {
  if (process.argv.includes('--stdin0')) {
    return fs.readFileSync(0).toString('utf8').split('\0').filter(Boolean);
  }
  return process.argv.slice(2);
}

function isProbablyText(buffer) {
  return !buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
}

const findings = [];

for (const file of inputFiles()) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) continue;

  const buffer = fs.readFileSync(file);
  if (!isProbablyText(buffer)) continue;

  const lines = buffer.toString('utf8').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes('secret-scan: allow-test-fixture')) continue;

    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        findings.push({ file, line: index + 1, rule: rule.name });
      }
    }

    assignmentPattern.lastIndex = 0;
    for (const match of line.matchAll(assignmentPattern)) {
      const value = match[3].trim();
      if (value.length >= 6 && !PLACEHOLDER.test(value) && !value.includes('process.env')) {
        findings.push({ file, line: index + 1, rule: `${match[1].toLowerCase()}-literal` });
      }
    }
  }
}

const uniqueFindings = [...new Map(
  findings.map((finding) => [`${finding.file}:${finding.line}:${finding.rule}`, finding]),
).values()];

if (uniqueFindings.length > 0) {
  console.error('Potential secrets detected. Values are intentionally not printed:');
  for (const finding of uniqueFindings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}]`);
  }
  process.exit(1);
}

console.log('Secret scan passed: no high-confidence credential patterns in tracked files.');
