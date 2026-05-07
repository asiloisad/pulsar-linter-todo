const fs = require("fs");
const path = require("path");
const { minimatch } = require("minimatch");

// Arrays of single-line comment markers per extension
const SINGLE_LINE = {
  ".js": ["//"], ".ts": ["//"], ".jsx": ["//"], ".tsx": ["//"],
  ".java": ["//"], ".c": ["//"], ".cpp": ["//"], ".h": ["//"], ".hpp": ["//"],
  ".cs": ["//"], ".go": ["//"], ".rs": ["//"], ".php": ["//"],
  ".swift": ["//"], ".kt": ["//"], ".scala": ["//"], ".dart": ["//"],
  ".vue": ["//"], ".svelte": ["//"], ".astro": ["//"],
  ".py": ["#"], ".ipy": ["#"], ".rb": ["#"],
  ".sh": ["#"], ".bash": ["#"], ".zsh": ["#"], ".ps1": ["#"],
  ".r": ["#"], ".yaml": ["#"], ".yml": ["#"], ".toml": ["#"],
  ".cfg": ["#"], ".ini": ["#"], ".conf": ["#"],
  ".pl": ["#"], ".pm": ["#"], ".coffee": ["#"], ".cson": ["#"],
  ".ex": ["#"], ".exs": ["#"],
  ".lua": ["--"], ".sql": ["--"], ".hs": ["--"],
  ".erl": ["%"], ".tex": ["%"], ".m": ["%"],
  ".el": [";"], ".clj": [";"],
  ".vim": ['"'],
  ".bat": ["::"], ".cmd": ["::"],
  ".dat": ["//", "$", "!"], ".gra": ["//", "$", "!"], ".grb": ["//", "$", "!"],
};

// Block comment markers per extension [open, close]
const BLOCK = {
  ".js": ["/*", "*/"], ".ts": ["/*", "*/"], ".jsx": ["/*", "*/"], ".tsx": ["/*", "*/"],
  ".java": ["/*", "*/"], ".c": ["/*", "*/"], ".cpp": ["/*", "*/"],
  ".h": ["/*", "*/"], ".hpp": ["/*", "*/"],
  ".cs": ["/*", "*/"], ".go": ["/*", "*/"], ".rs": ["/*", "*/"],
  ".php": ["/*", "*/"], ".swift": ["/*", "*/"], ".kt": ["/*", "*/"],
  ".scala": ["/*", "*/"], ".dart": ["/*", "*/"],
  ".css": ["/*", "*/"], ".scss": ["/*", "*/"], ".less": ["/*", "*/"],
  ".vue": ["/*", "*/"], ".svelte": ["/*", "*/"], ".astro": ["/*", "*/"],
  ".html": ["<!--", "-->"], ".xml": ["<!--", "-->"],
  ".hs": ["{-", "-}"], ".ml": ["(*", "*)"],
};

// Extensions where all content is plain text (scope text.plain in Pulsar) - every position is valid
const PLAIN_TEXT = new Set([".txt"]);

const KNOWN_EXTENSIONS = new Set([...Object.keys(SINGLE_LINE), ...Object.keys(BLOCK), ...PLAIN_TEXT]);

function buildCommentRegions(lines, ext) {
  if (PLAIN_TEXT.has(ext)) return null;

  const slMarkers = SINGLE_LINE[ext] || [];
  const bl = BLOCK[ext];
  if (!slMarkers.length && !bl) return [];

  const regions = lines.map(() => []);
  let inBlock = false;

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    let col = 0;

    if (inBlock) {
      const closeIdx = line.indexOf(bl[1]);
      if (closeIdx === -1) {
        regions[row].push([0, Infinity]);
        continue;
      }
      regions[row].push([0, closeIdx + bl[1].length]);
      inBlock = false;
      col = closeIdx + bl[1].length;
    }

    while (col < line.length) {
      if (bl && line.startsWith(bl[0], col)) {
        const closeIdx = line.indexOf(bl[1], col + bl[0].length);
        if (closeIdx === -1) {
          regions[row].push([col, Infinity]);
          inBlock = true;
          break;
        }
        regions[row].push([col, closeIdx + bl[1].length]);
        col = closeIdx + bl[1].length;
      } else {
        const slMarker = slMarkers.find((m) => line.startsWith(m, col));
        if (slMarker) {
          regions[row].push([col, Infinity]);
          break;
        }
        col++;
      }
    }
  }

  return regions;
}

function isInComment(regions, row, col) {
  if (regions === null) return true;
  return regions[row].some(([start, end]) => col >= start && col < end);
}

function isGlobIgnored(filePath, ignoreGlob) {
  if (!ignoreGlob) return false;
  const normalizedFilePath = process.platform === "win32" ? filePath.replace(/\\/g, "/") : filePath;
  return minimatch(normalizedFilePath, ignoreGlob, { dot: true });
}

function walkDirectory(dir, fileList, ignoredPatterns, ignoreGlob) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ignoredPatterns.some((p) => minimatch(entry.name, p, { dot: true }))) continue;
    const entryPath = path.join(dir, entry.name);
    if (isGlobIgnored(entryPath, ignoreGlob)) continue;
    if (entry.isDirectory()) {
      walkDirectory(entryPath, fileList, ignoredPatterns, ignoreGlob);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!KNOWN_EXTENSIONS.has(ext)) continue;
      fileList.push(entryPath);
    }
  }
}

function scanFile(filePath, regexSource, regexFlags) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }

  const ext = path.extname(filePath).toLowerCase();
  const lines = text.split("\n");
  const commentRegions = buildCommentRegions(lines, ext);
  const regex = new RegExp(regexSource, regexFlags);
  const messages = [];

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const col = match.index;
      if (!isInComment(commentRegions, row, col)) continue;

      const keyword = match[1];
      const afterKeyword = line.substring(col + keyword.length);
      const textInAfter = afterKeyword.replace(/^:\s*/, "").trimStart();
      const textStartColumn = col + keyword.length + (afterKeyword.length - textInAfter.length);
      let text = textInAfter.trimEnd();

      let nextRow = row + 1;
      while (text) {
        const nextLine = lines[nextRow];
        if (nextLine == null) break;
        const charAtCol = nextLine[textStartColumn];
        if (!charAtCol || charAtCol === " " || charAtCol === "\t") break;
        if (!isInComment(commentRegions, nextRow, textStartColumn)) break;
        text += " " + nextLine.substring(textStartColumn).trim();
        nextRow++;
      }

      const code = line.substring(0, col).replace(/[\s#\/\*!<>\-;:'"$]+$/, "").trim();

      let excerpt;
      if (text && code) excerpt = `${keyword}: ${text}, \`${code}\``;
      else if (text) excerpt = `${keyword}: ${text}`;
      else if (code) excerpt = `${keyword}: \`${code}\``;
      else excerpt = keyword;

      messages.push({
        severity: "info",
        excerpt,
        location: {
          file: filePath,
          position: [
            [row, col],
            [row, col + keyword.length],
          ],
        },
      });
    }
  }

  return messages;
}

module.exports = function(projectPaths, ignoredPatterns, ignoreGlob, regexSource, regexFlags) {
  const done = this.async();

  (async () => {
    const messages = [];
    const errors = [];

    for (const projectPath of projectPaths) {
      try {
        const files = [];
        walkDirectory(projectPath, files, ignoredPatterns, ignoreGlob);

        for (const filePath of files) {
          messages.push(...scanFile(filePath, regexSource, regexFlags));
        }
      } catch (error) {
        errors.push({
          projectPath,
          message: String(error.message || error),
        });
      }
    }

    emit("linter-todo:project-scan", { messages, errors });
  })()
    .catch((error) => {
      emit("linter-todo:project-scan", {
        messages: [],
        errors: [
          {
            message: String(error.message || error),
          },
        ],
      });
    })
    .then(done);
};
