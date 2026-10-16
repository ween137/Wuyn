// Local helper only. Never commit raw codes or generated output containing raw codes.
import { createHash } from 'node:crypto';
const code = process.argv[2];
if (!code || code.length < 6) { console.error('Usage: node scripts/hash-code.mjs "TEMPORARY_CODE"'); process.exit(1); }
console.log(createHash('sha256').update(code).digest('hex'));
