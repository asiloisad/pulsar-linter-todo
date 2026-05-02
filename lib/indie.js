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

// Extensions where all content is plain text (scope text.plain in Pulsar) — every position is valid
const PLAIN_TEXT = new Set([".txt"]);

const KNOWN_EXTENSIONS = new Set([...Object.keys(SINGLE_LINE), ...Object.keys(BLOCK), ...PLAIN_TEXT]);

function buildCommentRegions(lines, ext) {
  if (PLAIN_TEXT.has(ext)) return null;

  const slMarkers = SINGLE_LINE[ext] || [];
  const bl = BLOCK[ext];
  if (!slMarkers.length && !bl) return []; // no known comment syntax — no matches

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

class ProjectLinter {
  constructor() {
    this.indieDelegate = null;
    this.scanning = false;
    this.main = null;
  }

  register(delegate, main) {
    this.indieDelegate = delegate;
    this.main = main;
  }

  walkDirectory(dir, fileList, ignoredPatterns) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      if (ignoredPatterns.some((p) => minimatch(entry.name, p, { dot: true }))) continue;
      if (entry.isDirectory()) {
        this.walkDirectory(path.join(dir, entry.name), fileList, ignoredPatterns);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!KNOWN_EXTENSIONS.has(ext)) continue;
        fileList.push(path.join(dir, entry.name));
      }
    }
  }

  scanFile(filePath) {
    let text;
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch (e) {
      return [];
    }

    const ext = path.extname(filePath).toLowerCase();
    const lines = text.split("\n");
    const commentRegions = buildCommentRegions(lines, ext);
    const regex = new RegExp(this.main.regex.source, this.main.regex.flags);
    const messages = [];

    for (let row = 0; row < lines.length; row++) {
      const line = lines[row];
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(line)) !== null) {
        const col = match.index;
        if (!isInComment(commentRegions, row, col)) continue;

        const keyword = match[1];
        const text = line.substring(col + keyword.length).trim();
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

  async runScan() {
    if (!this.indieDelegate || !this.main) return;
    if (this.scanning) return;
    if (!this.main.regex) return;

    this.scanning = true;

    const projectPaths = atom.project.getPaths();
    if (!projectPaths.length) {
      this.scanning = false;
      return;
    }

    const allMessages = [];
    const ignoredPatterns = atom.config.get("core.ignoredNames") || [];

    try {
      for (const projectPath of projectPaths) {
        const files = [];
        this.walkDirectory(projectPath, files, ignoredPatterns);

        for (const filePath of files) {
          const msgs = this.scanFile(filePath);
          allMessages.push(...msgs);
        }
      }

      this.indieDelegate.setAllMessages(allMessages, {
        showProjectView: true,
      });
    } catch (error) {
      console.error("[linter-todo] Project scan failed:", error);
    } finally {
      this.scanning = false;
    }
  }

  dispose() {
    this.main = null;
    this.indieDelegate = null;
  }
}

module.exports = new ProjectLinter();
