// Runs PHP with the binary from PHP_BIN (set it in the root .env), falling back to `php` on PATH.
// Laravel 13 needs PHP 8.3+, and the PHP on PATH may be older (e.g. XAMPP's).
// Usage: node --env-file-if-exists=.env scripts/php.mjs <cwd> <args...>
import { spawn } from "node:child_process";
import path from "node:path";

const [cwd, ...args] = process.argv.slice(2);
const php = process.env.PHP_BIN || "php";

const child = spawn(php, args, {
  cwd: path.resolve(cwd),
  stdio: "inherit",
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
