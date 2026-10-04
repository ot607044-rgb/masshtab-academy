# Employee profile photos

HR/company administrators can upload, replace and remove a photo in Employees > Profile.
The employee list displays the same photo. Supported input: JPEG, PNG, WEBP, up to 5 MiB.
Images are decoded, resized to at most 512 x 512, and re-encoded as JPEG without uploaded metadata.

Migration 010 adds nullable employees.photo_filename; no new table is required.
Photo URLs require authenticated access and company scope. The persistent uploads volume
stores photos under .employee-photos/company/employee; the public static mount rejects this directory.
The browser requests photos with the existing authenticated API client and displays a temporary blob URL.

Release: 20261004-employee-photo. Backup: /opt/backups/masshtab-academy/20261004-employee-photo.
Rollback uses the backup rollback.yml with docker-compose.prod.yml and .env.prod.
The rollback backend keeps the private-files guard; do not restore the original unguarded image
while private photo files remain. The nullable database column is retained on rollback.

Checks: backend pytest, employee-photo.spec.ts on desktop/mobile, preview-integration.spec.ts
against the isolated PostgreSQL preview, read-only production API and browser smoke checks.
