const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { bumpVersion } = require("./release-utils");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const manifestPath = path.join(rootDir, "manifest.json");
const packagePath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseArgs(args) {
  const result = {
    bump: "patch",
    dryRun: false
  };
  if (args.includes("--major")) result.bump = "major";
  if (args.includes("--minor")) result.bump = "minor";
  if (args.includes("--patch")) result.bump = "patch";
  if (args.includes("--dry-run")) result.dryRun = true;
  return result;
}

function run(command, options = {}) {
  execSync(command, { stdio: "inherit", ...options });
}

function ensureCleanWorkingTree() {
  const output = execSync("git status --porcelain", {
    cwd: rootDir,
    encoding: "utf8"
  });
  if (output.trim().length > 0) {
    throw new Error("Working tree is not clean. Commit or stash changes before release.");
  }
}

function ensureVersionsMatch(manifest, pkg) {
  if (manifest.version !== pkg.version) {
    throw new Error(`Version mismatch: manifest ${manifest.version} vs package ${pkg.version}`);
  }
}

function updatePackageLockVersion(packageLock, version) {
  packageLock.version = version;
  if (packageLock.packages && packageLock.packages[""]) {
    packageLock.packages[""].version = version;
  }
  return packageLock;
}

function buildZip(version) {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  const zipName = `wegweiser-v${version}.zip`;
  const zipPath = path.join(distDir, zipName);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  const includeList = ["manifest.json", "icons", "src"];
  try {
    const cmd = `tar -a -c -f "${zipPath}" ${includeList.join(" ")}`;
    run(cmd, { cwd: rootDir });
  } catch (err) {
    if (process.platform !== "win32") {
      throw err;
    }
    const includePaths = includeList.map((entry) => `"${entry}"`).join(", ");
    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path ${includePaths} -DestinationPath \\"${zipPath}\\" -Force"`;
    run(psCmd, { cwd: rootDir });
  }
  return zipPath;
}

function trySignCrx(version) {
  const keyPath = process.env.CWS_PRIVATE_KEY_PATH;
  const chromePath = process.env.CHROME_PATH;
  if (!keyPath || !chromePath) {
    return null;
  }

  const extensionDir = rootDir;
  const pemPath = path.join(rootDir, path.basename(extensionDir) + ".pem");
  const cmd = `"${chromePath}" --pack-extension="${extensionDir}" --pack-extension-key="${keyPath}"`;
  run(cmd, { cwd: rootDir });

  const crxName = path.basename(extensionDir) + ".crx";
  const crxSource = path.join(rootDir, crxName);
  if (!fs.existsSync(crxSource)) {
    return null;
  }

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  const crxTarget = path.join(distDir, `wegweiser-v${version}.crx`);
  fs.renameSync(crxSource, crxTarget);
  const normalizedKeyPath = path.resolve(keyPath);
  const normalizedPemPath = path.resolve(pemPath);
  if (normalizedKeyPath !== normalizedPemPath && fs.existsSync(pemPath)) {
    fs.unlinkSync(pemPath);
  }
  return crxTarget;
}

function writeReleaseMeta(version, uploadZip, signedPath) {
  const meta = {
    version,
    uploadZip,
    signed: Boolean(signedPath),
    signedPath: signedPath || null
  };
  const metaPath = path.join(distDir, "release.json");
  writeJson(metaPath, meta);
  return metaPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Release mode: ${args.bump}${args.dryRun ? " (dry-run)" : ""}`);

  ensureCleanWorkingTree();
  run("npm test", { cwd: rootDir });

  const manifest = readJson(manifestPath);
  const pkg = readJson(packagePath);
  ensureVersionsMatch(manifest, pkg);

  const nextVersion = bumpVersion(manifest.version, args.bump);
  console.log(`Bumping version: ${manifest.version} -> ${nextVersion}`);

  if (args.dryRun) {
    console.log("Dry-run enabled: skipping writes, build, and packaging.");
    return;
  }

  manifest.version = nextVersion;
  pkg.version = nextVersion;
  writeJson(manifestPath, manifest);
  writeJson(packagePath, pkg);

  if (fs.existsSync(packageLockPath)) {
    const packageLock = updatePackageLockVersion(readJson(packageLockPath), nextVersion);
    writeJson(packageLockPath, packageLock);
  }

  if (fs.existsSync(path.join(rootDir, "tsconfig.json"))) {
    run("npm run build:ts", { cwd: rootDir });
  }

  const uploadZip = buildZip(nextVersion);
  const signedPath = trySignCrx(nextVersion);
  const metaPath = writeReleaseMeta(nextVersion, uploadZip, signedPath);

  console.log(`Upload ZIP: ${uploadZip}`);
  if (signedPath) {
    console.log(`Signed CRX: ${signedPath}`);
  } else {
    console.log("Signed CRX: not created (set CHROME_PATH and CWS_PRIVATE_KEY_PATH)");
  }
  console.log(`Release meta: ${metaPath}`);
}

main();
