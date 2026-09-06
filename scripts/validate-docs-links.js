const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".turbo",
  "dist",
  ".next",
  "build",
  "coverage",
  ".husky",
  "graphify-out",
]);

function getAllMarkdownFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) {
        results = results.concat(getAllMarkdownFiles(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

function extractLinks(filePath, content) {
  const links = [];
  // Regex to match [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const linkText = match[1];
    const linkTarget = match[2].trim();

    // Skip external URLs and anchor-only links
    if (
      linkTarget.startsWith("http://") ||
      linkTarget.startsWith("https://") ||
      linkTarget.startsWith("mailto:") ||
      linkTarget.startsWith("#")
    ) {
      continue;
    }

    links.push({
      text: linkText,
      target: linkTarget,
      file: filePath,
    });
  }

  return links;
}

function validateLinks() {
  console.log("=== Validating Documentation Markdown Links ===\n");

  const files = getAllMarkdownFiles(ROOT_DIR);
  console.log(`Found ${files.length} markdown documentation files.`);

  let totalLinks = 0;
  let validLinks = 0;
  let brokenLinks = [];

  for (const file of files) {
    const relFilePath = path.relative(ROOT_DIR, file);
    const content = fs.readFileSync(file, "utf-8");
    const links = extractLinks(file, content);

    for (const link of links) {
      totalLinks++;

      // Split link target from anchor
      const [filePathPart, anchorPart] = link.target.split("#");

      if (!filePathPart) {
        // Was an anchor on current file
        validLinks++;
        continue;
      }

      const fileDir = path.dirname(file);
      const targetAbsPath = path.resolve(fileDir, filePathPart);

      if (fs.existsSync(targetAbsPath)) {
        validLinks++;
      } else {
        brokenLinks.push({
          sourceFile: relFilePath,
          linkText: link.text,
          target: link.target,
          resolvedPath: path.relative(ROOT_DIR, targetAbsPath),
        });
      }
    }
  }

  console.log(`Total relative links scanned: ${totalLinks}`);
  console.log(`Valid links: ${validLinks}`);

  if (brokenLinks.length > 0) {
    console.error(`\n❌ Found ${brokenLinks.length} broken links:\n`);
    for (const broken of brokenLinks) {
      console.error(`  Source:   ${broken.sourceFile}`);
      console.error(`  Link:     [${broken.linkText}](${broken.target})`);
      console.error(`  Target:   ${broken.resolvedPath} (DOES NOT EXIST)\n`);
    }
    process.exit(1);
  }

  console.log("\n✅ All documentation links verified successfully! Zero broken links.");
}

validateLinks();
