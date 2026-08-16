import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Local, ephemeral storage for generated report files — replaces Cloudinary
// for the reports feature. Used for the "download last run" link and as the
// media URL Twilio needs for WhatsApp delivery. Not a permanent archive:
// files are pruned after REPORT_FILE_TTL_MS and won't survive a redeploy on
// platforms with an ephemeral filesystem. Fine for "download what was just
// emailed to you" / same-run WhatsApp delivery, which is what this is for.
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'reports');
const REPORT_FILE_TTL_MS = 48 * 60 * 60 * 1000; // 48h
const TOKEN_RE = /^[a-f0-9]{32}\.(pdf|xlsx|csv)$/;

function ensureStorageDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export function saveReportFile(buffer: Buffer, ext: 'pdf' | 'xlsx' | 'csv'): { token: string; filename: string } {
  ensureStorageDir();
  const token = crypto.randomBytes(16).toString('hex');
  const filename = `${token}.${ext}`;
  fs.writeFileSync(path.join(STORAGE_DIR, filename), buffer);
  return { token, filename };
}

/** Resolves a requested filename to a safe absolute path, or null if invalid/not found. */
export function resolveReportFile(filename: string): string | null {
  if (!TOKEN_RE.test(filename)) return null;
  const filePath = path.join(STORAGE_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

export function buildReportDownloadUrl(filename: string): string {
  const base = process.env.BETTER_AUTH_URL || 'http://localhost:4000';
  return `${base.replace(/\/$/, '')}/api/reports/download/${filename}`;
}

export function cleanupOldReportFiles() {
  ensureStorageDir();
  const now = Date.now();
  for (const entry of fs.readdirSync(STORAGE_DIR)) {
    const filePath = path.join(STORAGE_DIR, entry);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > REPORT_FILE_TTL_MS) fs.unlinkSync(filePath);
    } catch {
      // file may have been removed concurrently — ignore
    }
  }
}
