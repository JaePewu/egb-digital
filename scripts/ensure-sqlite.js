const fs = require("node:fs");
const path = require("node:path");

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

if (!fs.existsSync(dbPath)) {
  fs.closeSync(fs.openSync(dbPath, "w"));
}
