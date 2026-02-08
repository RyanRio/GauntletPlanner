#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function usage() {
  console.log(`
Usage: node setup-gauntlet.js --xlsx /path/to/file.xlsx --pairs /path/to/export.json [--python python]

Options:
  --xlsx    Path to the downloaded XLSX file
  --pairs   Path to your SyncPairsTracker export JSON
  --python  Python executable to use (optional)
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (key === "--xlsx") out.xlsx = args[++i];
    else if (key === "--pairs") out.pairs = args[++i];
    else if (key === "--python") out.python = args[++i];
    else if (key === "-h" || key === "--help") {
      usage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${key}`);
      usage();
      process.exit(1);
    }
  }
  return out;
}

function ensureExists(p, label) {
  if (!p || !fs.existsSync(p)) {
    console.error(`${label} not found: ${p || "(missing)"}`);
    process.exit(1);
  }
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function runCommand(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  return res.status === 0;
}

function main() {
  const args = parseArgs();
  ensureExists(args.xlsx, "XLSX");
  ensureExists(args.pairs, "Pairs JSON");

  const repoRoot = path.resolve(__dirname);
  const trackerDir = path.join(repoRoot, "SyncPairsTracker");
  const plannerDir = path.join(repoRoot, "gauntlet-planner");

  ensureExists(trackerDir, "SyncPairsTracker directory");

  fs.mkdirSync(path.join(plannerDir, "vendor"), { recursive: true });
  fs.mkdirSync(path.join(plannerDir, "icons"), { recursive: true });
  fs.mkdirSync(path.join(plannerDir, "clears_images"), { recursive: true });

  fs.copyFileSync(
    path.join(trackerDir, "js", "syncpairs.js"),
    path.join(plannerDir, "vendor", "syncpairs.js")
  );

  copyDir(path.join(trackerDir, "icons"), path.join(plannerDir, "icons"));

  fs.copyFileSync(args.pairs, path.join(plannerDir, "my_pairs.json"));

  const extractor = path.join(plannerDir, "tools", "extract_xlsx.py");
  const outJson = path.join(plannerDir, "clears_from_xlsx.json");
  const outImages = path.join(plannerDir, "clears_images");

  let python = args.python;

  if (!python) {
    // Try conda env 'poke' if conda is available
    const condaOk = runCommand("conda", ["--version"]);
    if (condaOk) {
      const ok = runCommand("conda", [
        "run",
        "-n",
        "poke",
        "python",
        extractor,
        args.xlsx,
        "--out-json",
        outJson,
        "--out-images",
        outImages
      ]);
      if (ok) {
        console.log("Setup complete (conda env: poke)." );
        return;
      }
    }
  }

  if (!python) {
    python = process.platform === "win32" ? "python" : "python3";
  }

  const ok = runCommand(python, [
    extractor,
    args.xlsx,
    "--out-json",
    outJson,
    "--out-images",
    outImages
  ]);

  if (!ok) {
    console.error("Setup failed: Python extraction did not succeed.");
    process.exit(1);
  }

  console.log("Setup complete.");
}

main();
