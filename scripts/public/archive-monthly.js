#!/usr/bin/env node

/**
 * Monthly Archive Script for Kosmos
 *
 * Archives projects, todos, memories, and investigations from previous months
 * into organized YYYY/MM folders within each content type's archives directory.
 * Covers both public/ and personal/ trees.
 *
 * Age is the only signal: an item archives once its filename's YYYY-MM-DD date
 * is older than the previous calendar month. There is no status or completion
 * check — frontmatter status drifts out of date long before anyone updates it,
 * so it cannot gate anything reliably.
 *
 * Usage:
 *   node archive-monthly.js [options]
 *
 * Options:
 *   --dry-run        Preview changes without moving files
 *   --verbose        Show detailed debug output
 *   --month MM       Explicit cutoff month (1-12). Archives everything dated
 *                    before MM 1st — it does NOT archive month MM itself.
 *   --year YYYY      Explicit cutoff year, paired with --month.
 */

const fs = require('fs').promises;
const path = require('path');

// scripts/public/archive-monthly.js -> workspace root. Resolving against this
// instead of process.cwd() means the script behaves the same run from the repo
// root or from its own directory, instead of silently finding nothing.
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');

// One entry per content type; each is archived for both public/ and personal/.
// includesFolders controls whether a dated directory (not just a dated .md
// file) is a valid archive candidate for that type.
const CONTENT_AREAS = [
  { name: 'projects', dir: 'projects', includesFolders: true },
  { name: 'todos', dir: 'todos', includesFolders: true },
  { name: 'memories', dir: 'memories', includesFolders: false },
  {
    name: 'investigations',
    dir: 'docs/investigations',
    includesFolders: false,
  },
];
const VISIBILITIES = ['public', 'personal'];

// Configuration
const CONFIG = {
  contentTypes: CONTENT_AREAS.flatMap((area) =>
    VISIBILITIES.map((visibility) => {
      const relBase = path.join(area.dir, visibility);
      return {
        name: `${area.name}/${visibility}`,
        displayBase: relBase,
        basePath: path.join(WORKSPACE_ROOT, relBase),
        archivePath: path.join(WORKSPACE_ROOT, relBase, 'archives'),
        includesFolders: area.includesFolders,
      };
    }),
  ),
  datePattern: /^(\d{4})-(\d{2})-(\d{2})-/,
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    verbose: false,
    targetMonth: null,
    targetYear: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--month':
        options.targetMonth = parseInt(args[++i], 10);
        break;
      case '--year':
        options.targetYear = parseInt(args[++i], 10);
        break;
    }
  }

  return options;
}

// Extract date from filename
function extractDateFromFilename(filename) {
  const match = filename.match(CONFIG.datePattern);
  if (!match) {
    return null;
  }

  const [year, month, day] = [match[1], match[2], match[3]].map((n) =>
    parseInt(n, 10),
  );
  const date = new Date(year, month - 1, day);

  // The Date constructor normalises out-of-range parts instead of failing, so
  // 2026-13-40 becomes February 2027 and 2026-00-15 becomes December 2025 — both
  // would be filed under a month the name never mentioned. Round-tripping the
  // parts is what proves the date is real.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

// Ensure directory exists
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error.message);
  }
}

// Move file or folder with conflict resolution
async function moveItem(sourcePath, destPath, options) {
  const displaySource = path.relative(WORKSPACE_ROOT, sourcePath);
  const displayDest = path.relative(WORKSPACE_ROOT, destPath);

  if (options.dryRun) {
    console.log(`[DRY RUN] Would move: ${displaySource} -> ${displayDest}`);
    return { success: true, dryRun: true };
  }

  try {
    // Check if destination exists
    let finalDestPath = destPath;
    let suffix = 1;

    while (true) {
      try {
        await fs.access(finalDestPath);
        // File exists, add suffix. Folders have no extension, and slice(0, -0)
        // returns '' rather than the whole string — which would rename the item
        // to '_1' at the repo root instead of inside the archive.
        const ext = path.extname(destPath);
        const base = ext ? destPath.slice(0, -ext.length) : destPath;
        finalDestPath = `${base}_${suffix}${ext}`;
        suffix++;
      } catch {
        // File doesn't exist, we can use this path
        break;
      }
    }

    // Ensure destination directory exists
    await ensureDirectory(path.dirname(finalDestPath));

    // Move the item
    await fs.rename(sourcePath, finalDestPath);

    if (options.verbose) {
      console.log(
        `Moved: ${displaySource} -> ${path.relative(WORKSPACE_ROOT, finalDestPath)}`,
      );
    }

    return { success: true, path: finalDestPath };
  } catch (error) {
    console.error(`Error moving ${displaySource}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Process a single content type
async function processContentType(contentType, cutoff, options) {
  const results = {
    archived: [],
    skipped: [],
    errors: [],
  };

  try {
    // Read directory contents
    let items;
    try {
      items = await fs.readdir(contentType.basePath);
    } catch (error) {
      // A content type this workspace does not use is not a failure. Reporting it
      // as an error makes the script exit non-zero after it has already moved
      // files, which in CI aborts the job before anything gets committed.
      if (error.code === 'ENOENT') {
        console.log(
          `  ${contentType.displayBase} does not exist — nothing to archive`,
        );
        return results;
      }
      throw error;
    }

    if (options.verbose) {
      console.log(
        `  Found ${items.length} items in ${contentType.displayBase}`,
      );
    }

    for (const item of items) {
      // Skip archives directory
      if (item === 'archives') {
        continue;
      }

      // Skip items that don't match the date naming convention (YYYY-MM-DD-*).
      // This also filters out template files (project.md, todo.md, README.md, ...)
      // since none of them carry a date prefix.
      if (!CONFIG.datePattern.test(item)) {
        if (options.verbose) {
          console.log(`  Skipping ${item}: does not match date pattern`);
        }
        continue;
      }

      const itemPath = path.join(contentType.basePath, item);
      // A dated entry that cannot be stat'ed — dangling symlink, unreadable path —
      // must not abandon the rest of the tree: the outer catch sits outside this
      // loop, so a throw here would skip every remaining item silently.
      let stats;
      try {
        stats = await fs.stat(itemPath);
      } catch (error) {
        console.error(`Error reading ${item}:`, error.message);
        results.errors.push({ path: item, error: error.message });
        continue;
      }
      const isFolder = stats.isDirectory() && contentType.includesFolders;

      if (!isFolder && !(stats.isFile() && item.endsWith('.md'))) {
        continue;
      }

      // The guard above guarantees the name carries a YYYY-MM-DD prefix, so this
      // is the item's date. An impossible date (2026-13-40) would silently roll
      // over into a neighbouring month, so reject it rather than misfile it.
      const creationDate = extractDateFromFilename(item);
      if (!creationDate || Number.isNaN(creationDate.getTime())) {
        results.skipped.push({
          path: item,
          reason: 'unparseable date in filename',
        });
        continue;
      }

      if (creationDate >= cutoff) {
        results.skipped.push({
          path: item,
          reason: 'not old enough to archive yet',
        });
        continue;
      }

      const year = creationDate.getFullYear();
      const month = String(creationDate.getMonth() + 1).padStart(2, '0');
      const archiveDest = path.join(
        contentType.archivePath,
        year.toString(),
        month,
        item,
      );

      const result = await moveItem(itemPath, archiveDest, options);
      if (result.success) {
        results.archived.push({
          type: isFolder ? 'folder' : 'file',
          path: item,
          archived: `${year}/${month}`,
        });
      } else {
        results.errors.push({ path: item, error: result.error });
      }
    }
  } catch (error) {
    console.error(`Error processing ${contentType.name}:`, error.message);
    results.errors.push({
      path: contentType.displayBase,
      error: error.message,
    });
  }

  return results;
}

// Cutoff labels render as YYYY-MM in three places — the banner, the CI step
// output, and the future-cutoff error.
function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Write step outputs for the CI workflow: the cutoff this run actually used —
// so the commit/PR title names the archived month instead of re-deriving
// today's date in bash and getting the *run* month instead — plus a
// per-content-type breakdown for the step summary. A local run has no
// GITHUB_OUTPUT and skips this entirely.
async function writeGithubOutputs({
  cutoff,
  totalArchived,
  totalErrors,
  allResults,
}) {
  const cutoffLabel = formatMonth(cutoff);
  const details = Object.entries(allResults)
    .filter(([, results]) => results.archived.length > 0)
    .map(
      ([name, results]) => `- \`${name}\`: ${results.archived.length} archived`,
    )
    .join('\n');

  const lines = [
    `cutoff=${cutoffLabel}`,
    `archived=${totalArchived}`,
    `errors=${totalErrors}`,
  ];
  await fs.appendFile(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');

  if (details) {
    // Multiline values need the <<DELIM / DELIM block form — a plain `key=value`
    // truncates at the first newline. Content here is always this workspace's own
    // content-type names and counts, never PR-controlled input, so a fixed
    // delimiter is safe.
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `details<<ARCHIVE_DETAILS_EOF\n${details}\nARCHIVE_DETAILS_EOF\n`,
    );
  }
}

// Main execution
async function main() {
  const options = parseArgs();
  const now = new Date();

  if (
    options.targetMonth !== null &&
    !(options.targetMonth >= 1 && options.targetMonth <= 12)
  ) {
    console.error(`Invalid --month ${options.targetMonth}: expected 1-12`);
    process.exit(1);
  }
  if (
    options.targetYear !== null &&
    !(options.targetYear >= 2000 && options.targetYear <= 2999)
  ) {
    console.error(
      `Invalid --year ${options.targetYear}: expected a four-digit year`,
    );
    process.exit(1);
  }
  // --year alone would take its month from the run date, not from the caller —
  // a cutoff nobody asked for, in either direction.
  if (options.targetYear !== null && options.targetMonth === null) {
    console.error('--year requires --month');
    process.exit(1);
  }

  // Build the cutoff from parts instead of mutating today's date. setMonth() keeps
  // the day-of-month, so on the 29th-31st it overflows into the following month:
  // `--month 2` run on July 29 lands on March 1 because Feb 29 does not exist in a
  // non-leap year. Everything dated before this cutoff is eligible.
  //
  // With no explicit --month/--year, the cutoff is the *previous* calendar month,
  // not the current one — giving every item at least one full month of shelf life
  // before it archives. An explicit --month/--year is unchanged: it names the
  // cutoff month directly (--month 7 archives everything before Jul 1, not Jul
  // itself). getMonth() - 1 rolling to -1 in January is intentional: the Date
  // constructor normalises `new Date(2026, -1, 1)` to 2025-12-01.
  const cutoffYear = options.targetYear ?? now.getFullYear();
  const cutoffMonth =
    options.targetMonth !== null ? options.targetMonth - 1 : now.getMonth() - 1;
  const cutoff = new Date(cutoffYear, cutoffMonth, 1);

  // A cutoff later than today would archive items that are days old, or not yet
  // written. --month without --year is the way in: the year comes from the run
  // date, so any month after the current one lands in the future.
  if (cutoff > now) {
    console.error(
      `Cutoff ${formatMonth(cutoff)}-01 is in the future — it would archive items less than a month old.`,
    );
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log('Monthly Archive Script');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`Archiving items dated before: ${formatMonth(cutoff)}-01`);
  console.log('='.repeat(50));

  const allResults = {};

  // Process each content type
  for (const contentType of CONFIG.contentTypes) {
    console.log(`\nProcessing ${contentType.name}...`);
    const results = await processContentType(contentType, cutoff, options);
    allResults[contentType.name] = results;

    // Display summary
    console.log(`  Archived: ${results.archived.length}`);
    console.log(`  Skipped: ${results.skipped.length}`);
    if (results.errors.length > 0) {
      console.log(`  Errors: ${results.errors.length}`);
    }

    if (options.verbose) {
      if (results.archived.length > 0) {
        console.log('  Archived items:');
        results.archived.forEach((item) => {
          console.log(`    - ${item.path} -> ${item.archived}`);
        });
      }
      if (results.skipped.length > 0) {
        console.log('  Skipped items:');
        results.skipped.forEach((item) => {
          console.log(`    - ${item.path}: ${item.reason}`);
        });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Archive Complete');

  const totalArchived = Object.values(allResults).reduce(
    (sum, r) => sum + r.archived.length,
    0,
  );
  const totalErrors = Object.values(allResults).reduce(
    (sum, r) => sum + r.errors.length,
    0,
  );

  console.log(`Total items archived: ${totalArchived}`);

  if (process.env.GITHUB_OUTPUT) {
    await writeGithubOutputs({
      cutoff,
      totalArchived,
      totalErrors,
      allResults,
    });
  }

  if (totalErrors > 0) {
    console.log(`Total errors: ${totalErrors}`);
    process.exit(1);
  }

  console.log('='.repeat(50));
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
