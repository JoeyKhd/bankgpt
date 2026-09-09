const fs = require("fs");
const db = require("better-sqlite3")("/data/engine.sqlite");
const file = process.argv[2];
const stmts = fs.readFileSync(file, "utf8");
db.exec(stmts);
console.log("applied", file);
const rows = db.prepare("SELECT id, version, risk, reviewed FROM capabilities ORDER BY id, version").all();
console.log(JSON.stringify(rows, null, 2));
