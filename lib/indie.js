const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([".git", ".hg", ".svn", "node_modules", "__pycache__", ".venv", "venv"]);

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

  walkDirectory(dir, fileList) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        this.walkDirectory(path.join(dir, entry.name), fileList);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!this.main.extensions.has(ext)) continue;
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

    const regex = new RegExp(this.main.regex.source, this.main.regex.flags);
    const messages = [];
    const lines = text.split("\n");

    for (let row = 0; row < lines.length; row++) {
      const line = lines[row];
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(line)) !== null) {
        const keyword = match[1];
        const col = match.index;
        const afterKeyword = line.substring(col + keyword.length).trim();
        const beforeKeyword = line.substring(0, col).trim();
        const context = afterKeyword || beforeKeyword;
        const excerpt = context ? `${keyword}: ${context}` : keyword;

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

    try {
      for (const projectPath of projectPaths) {
        const files = [];
        this.walkDirectory(projectPath, files);

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
