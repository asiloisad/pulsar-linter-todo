const { Task } = require("atom");
const path = require("path");

class ProjectLinter {
  constructor() {
    this.indieDelegate = null;
    this.busySignal = null;
    this.busyMessage = null;
    this.scanning = false;
    this.main = null;
    this.scanId = 0;
    this.task = null;
  }

  register(delegate, main) {
    this.indieDelegate = delegate;
    this.main = main;
  }

  setBusySignal(busySignal) {
    this.busySignal = busySignal;
  }

  startBusyMessage() {
    this.disposeBusyMessage();
    if (this.busySignal && typeof this.busySignal.reportBusy === "function") {
      this.busyMessage = this.busySignal.reportBusy("Scanning project for TODOs");
    }
  }

  disposeBusyMessage() {
    if (this.busyMessage && typeof this.busyMessage.dispose === "function") {
      this.busyMessage.dispose();
    }
    this.busyMessage = null;
  }

  runScan() {
    if (!this.indieDelegate || !this.main) return;
    if (this.scanning) return;
    if (!this.main.regex) return;

    this.scanning = true;
    this.startBusyMessage();

    const projectPaths = atom.project.getPaths();
    if (!projectPaths.length) {
      this.disposeBusyMessage();
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
        this.disposeBusyMessage();
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
      this.disposeBusyMessage();
    });
  }

  dispose() {
    this.scanId++;
    if (this.task && typeof this.task.terminate === "function") {
      this.task.terminate();
    }
    this.task = null;
    this.disposeBusyMessage();
    this.scanning = false;
    this.busySignal = null;
    this.main = null;
    this.indieDelegate = null;
  }
}

module.exports = new ProjectLinter();
