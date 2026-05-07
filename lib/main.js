const { CompositeDisposable, Disposable } = require("atom");
const indie = require("./indie");

module.exports = {
  activate() {
    this.disposables = new CompositeDisposable();

    this.disposables.add(
      atom.config.observe("linter-todo.state", (value) => {
        this.state = value;
      }),
      atom.config.observe("linter-todo.keywords", (value) => {
        this.keywords = value;
        this.buildRegex();
      }),
      atom.commands.add("atom-workspace", {
        "linter-todo:toggle-state": () => {
          atom.config.set("linter-todo.state", !this.state);
        },
        "linter-todo:lint-projects": () => {
          indie.runScan();
        },
        "linter-todo:lint-selected": () => {
          indie.runSelectedScan();
        },
      }),
      atom.commands.add(".tree-view", {
        "linter-todo:lint-selected": () => {
          indie.runSelectedScan();
        },
      }),
    );
  },

  deactivate() {
    indie.dispose();
    this.disposables.dispose();
  },

  provideLinter() {
    return {
      name: "TODO",
      scope: "file",
      lintsOnChange: true,
      grammarScopes: ["*"],
      lint: this.lint.bind(this),
    };
  },

  consumeIndie(registerIndie) {
    const delegate = registerIndie({
      name: "TODO/Project",
      deleteOnOpen: true,
    });
    this.disposables.add(delegate);
    indie.register(delegate, this);
  },

  consumeBusySignal(busySignal) {
    indie.setBusySignal(busySignal);
  },

  consumeTreeView(treeView) {
    indie.setTreeView(treeView);
    return new Disposable(() => {
      indie.setTreeView(null);
    });
  },

  buildRegex() {
    if (!this.keywords || !this.keywords.length) {
      this.regex = null;
      return;
    }
    const escaped = this.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    this.regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "g");
  },

  lint(editor) {
    if (!this.state || !this.regex) {
      return [];
    }

    const filePath = editor.getPath();
    if (!filePath) return [];

    const messages = [];

    editor.scan(this.regex, ({ match, range }) => {
      const scopes = editor.scopeDescriptorForBufferPosition(range.start).getScopesArray();
      if (!scopes.some((s) => s.startsWith("comment") || s === "text.plain")) return;

      const keyword = match[1];
      const lineText = editor.lineTextForBufferRow(range.start.row);
      const afterKeyword = lineText.substring(range.end.column);
      const textInAfter = afterKeyword.replace(/^:\s*/, "").trimStart();
      const textStartColumn = range.end.column + (afterKeyword.length - textInAfter.length);
      let text = textInAfter.trimEnd();

      let nextRow = range.start.row + 1;
      while (text) {
        const nextLine = editor.lineTextForBufferRow(nextRow);
        if (nextLine == null) break;
        const charAtCol = nextLine[textStartColumn];
        if (!charAtCol || charAtCol === " " || charAtCol === "\t") break;
        const nextScopes = editor.scopeDescriptorForBufferPosition([nextRow, textStartColumn]).getScopesArray();
        if (!nextScopes.some((s) => s.startsWith("comment") || s === "text.plain")) break;
        text += " " + nextLine.substring(textStartColumn).trim();
        nextRow++;
      }

      const code = lineText.substring(0, range.start.column).replace(/[\s#\/\*!<>\-]+$/, "").trim();

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
            [range.start.row, range.start.column],
            [range.end.row, range.end.column],
          ],
        },
      });
    });

    return messages;
  },
};
