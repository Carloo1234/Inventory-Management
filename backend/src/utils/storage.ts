import { promises as fs } from "node:fs";
import path from "node:path";

export interface StorageProvider {
    // Persists bytes and returns the servable URL.
    save(input: { shopId: string; filename: string; buffer: Buffer; mimetype: string }): Promise<string>;

    remove(url: string): Promise<void>;
}

export const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

export function extensionForMimetype(mimetype: string): string | null {
    const extByMime: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    };
    return extByMime[mimetype] ?? null;
}

// 5MB per file: large enough for phone photos, small enough that RAM-buffered
// uploads (memoryStorage, see products routes) can't exhaust the server too much.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class LocalDiskStorage implements StorageProvider {
    async ensureRoot() {
        await fs.mkdir(UPLOADS_ROOT, { recursive: true });
    }

    async save({ shopId, filename, buffer }: { shopId: string; filename: string; buffer: Buffer; mimetype: string }) {
        const dir = path.join(UPLOADS_ROOT, shopId);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, filename), buffer);
        return `/uploads/${shopId}/${filename}`;
    }

    async remove(url: string) {
        try {
            if (!url.startsWith("/uploads/")) return;
            const clean = url.split("?")[0] as string;
            const resolved = path.resolve(UPLOADS_ROOT, `.${clean.replace(/^\/uploads/, "")}`);
            if (!resolved.startsWith(UPLOADS_ROOT)) return;
            await fs.unlink(resolved);
            // Remove shop folder if its empty
            await fs.rmdir(path.dirname(resolved)).catch(() => {});
        } catch (error) {
            console.log(`Orphaned image file (manual cleanup): ${url}`, error);
        }
    }
}

export const storage: StorageProvider = new LocalDiskStorage();
