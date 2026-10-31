import express, { Request, Response } from "express";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

interface Item {
  id: number;
  title: string;
  category: string;
  year: number;
  watched: boolean;
  cover: string;
}

interface ItemRow {
  id: number;
  title: string;
  category: string;
  year: number;
  watched: number;
  cover: string;
}

const GENERIC_COVERS: readonly string[] = [
  "/covers/cover_red.svg",
  "/covers/cover_blue.svg",
  "/covers/cover_green.svg",
];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  gif: "gif",
};

const CATEGORIES: readonly string[] = [
  "Ação",
  "Comédia",
  "Drama",
  "Ficção Científica",
  "Terror",
  "Animação",
  "Documentário",
  "Série",
];

const rootDir: string = path.resolve(__dirname, "..", "..");
const dataDir: string = path.join(rootDir, "data");
const uploadsDir: string = path.join(dataDir, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, "catalogo.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    year INTEGER NOT NULL,
    watched INTEGER NOT NULL DEFAULT 0,
    cover TEXT NOT NULL DEFAULT ''
  )
`);

const columns = db.prepare("PRAGMA table_info(items)").all() as { name: string }[];
if (!columns.some((c: { name: string }): boolean => c.name === "cover")) {
  db.exec("ALTER TABLE items ADD COLUMN cover TEXT NOT NULL DEFAULT ''");
}

function randomGenericCover(): string {
  return GENERIC_COVERS[Math.floor(Math.random() * GENERIC_COVERS.length)];
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    year: row.year,
    watched: row.watched === 1,
    cover: row.cover !== "" ? row.cover : GENERIC_COVERS[row.id % GENERIC_COVERS.length],
  };
}

/** Salva uma imagem enviada como data URL e retorna a URL pública, ou lança erro de validação. */
function saveImage(dataUrl: string): string {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,/.exec(dataUrl);
  if (match === null) {
    throw new Error("Imagem inválida. Use PNG, JPG, WEBP ou GIF.");
  }
  const buffer = Buffer.from(dataUrl.slice(match[0].length), "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("A imagem deve ter no máximo 2 MB.");
  }
  const fileName = `${randomUUID()}.${IMAGE_EXTENSIONS[match[1]]}`;
  fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
  return `/uploads/${fileName}`;
}

function deleteUploadedFile(cover: string): void {
  if (!cover.startsWith("/uploads/")) return;
  const file = path.join(uploadsDir, path.basename(cover));
  fs.rm(file, { force: true }, (): void => undefined);
}

function isValidYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1888 &&
    value <= new Date().getFullYear() + 5
  );
}

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(rootDir, "public")));
app.use("/uploads", express.static(uploadsDir));

app.get("/api/categories", (_req: Request, res: Response): void => {
  res.json(CATEGORIES);
});

app.get("/api/items", (_req: Request, res: Response): void => {
  const rows = db.prepare("SELECT * FROM items ORDER BY id DESC").all() as ItemRow[];
  res.json(rows.map(toItem));
});

app.post("/api/items", (req: Request, res: Response): void => {
  const body = req.body as Partial<Record<keyof Item | "image", unknown>>;
  const title: string = typeof body.title === "string" ? body.title.trim() : "";
  const category: unknown = body.category;

  if (title.length === 0 || title.length > 120) {
    res.status(400).json({ error: "Título obrigatório (até 120 caracteres)." });
    return;
  }
  if (typeof category !== "string" || !CATEGORIES.includes(category)) {
    res.status(400).json({ error: "Categoria inválida." });
    return;
  }
  if (!isValidYear(body.year)) {
    res.status(400).json({ error: "Ano inválido." });
    return;
  }
  const watched: boolean = body.watched === true;

  let cover: string = randomGenericCover();
  if (body.image !== undefined && body.image !== null && body.image !== "") {
    if (typeof body.image !== "string") {
      res.status(400).json({ error: "Imagem inválida." });
      return;
    }
    try {
      cover = saveImage(body.image);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Imagem inválida." });
      return;
    }
  }

  const info = db
    .prepare("INSERT INTO items (title, category, year, watched, cover) VALUES (?, ?, ?, ?, ?)")
    .run(title, category, body.year, watched ? 1 : 0, cover);
  const row = db
    .prepare("SELECT * FROM items WHERE id = ?")
    .get(info.lastInsertRowid) as ItemRow;
  res.status(201).json(toItem(row));
});

app.patch("/api/items/:id", (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const body = req.body as { watched?: unknown };
  if (!Number.isInteger(id) || typeof body.watched !== "boolean") {
    res.status(400).json({ error: "Requisição inválida." });
    return;
  }
  const info = db
    .prepare("UPDATE items SET watched = ? WHERE id = ?")
    .run(body.watched ? 1 : 0, id);
  if (info.changes === 0) {
    res.status(404).json({ error: "Item não encontrado." });
    return;
  }
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as ItemRow;
  res.json(toItem(row));
});

app.delete("/api/items/:id", (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Requisição inválida." });
    return;
  }
  const existing = db.prepare("SELECT cover FROM items WHERE id = ?").get(id) as
    | { cover: string }
    | undefined;
  const info = db.prepare("DELETE FROM items WHERE id = ?").run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: "Item não encontrado." });
    return;
  }
  if (existing !== undefined) deleteUploadedFile(existing.cover);
  res.status(204).end();
});

const port: number = Number(process.env.PORT) || 3000;
app.listen(port, (): void => {
  console.log(`Moviest rodando em http://localhost:${port}`);
});
