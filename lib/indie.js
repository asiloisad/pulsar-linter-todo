const { Task } = require("atom");
const path = require("path");

class ProjectLinter {
  constructor() {
    this.indieDelegate = null;
    this.scanning = false;
    this.main = null;
    this.scanId = 0;
    this.task = null;
  }

  register(delegate, main) {
    this.indieDelegate = delegate;
    this.main = main;
  }

  runScan() {
    if (!this.indieDelegate || !this.main) return;
    if (this.scanning) return;
    if (!this.main.regex) return;

    this.scanning = true;

    const projectPaths = atom.project.getPaths();
    if (!projectPaths.length) {
      this.scanning = false;
      return;
    }

    const ignoredPatterns = atom.config.get("core.ignoredNames") || [];
    const taskPath = path.join(__dirname, "scanner.js");
    const scanId = ++this.scanId;
    let receivedResults = false;
    const task = Task.once(
      taskPath,
      projectPaths,
      ignoredPatterns,
      this.main.regex.source,
      this.main.regex.flags,
      () => {
        if (scanId !== this.scanId || !this.indieDelegate || receivedResults) return;

        this.indieDelegate.setAllMessages([], {
          showProjectView: true,
        });
        atom.notifications.addWarning("TODO project scan failed", {
          detail: "The scan task finished without returning results.",
          dismissable: true,
        });
        this.scanning = false;
        this.task = null;
      },
    );
    this.task = task;

    task.on("linter-todo:project-scan", ({ messages = [], errors = [] } = {}) => {
      if (scanId !== this.scanId || !this.indieDelegate) return;
      receivedResults = true;

      this.indieDelegate.setAllMessages(messages, {
        showProjectView: true,
      });

      for (const error of errors) {
        console.error("[linter-todo] Project scan failed:", error);
        atom.notifications.addWarning("TODO project scan failed", {
          detail: error.projectPath ? `${error.projectPath}\n\n${error.message}` : error.message,
          dismissable: true,
        });
      }

      this.scanning = false;
      this.task = null;
    });
  }

  dispose() {
    this.scanId++;
    if (this.task && typeof this.task.terminate === "function") {
      this.task.terminate();
    }
    this.task = null;
    this.scanning = false;
    this.main = null;
    this.indieDelegate = null;
  }
}

module.exports = new ProjectLinter();
