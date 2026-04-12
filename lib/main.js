const { CompositeDisposable } = require("atom");
const indie = require("./indie");

module.exports = {
  activate() {
    this.disposables = new CompositeDisposable();

    this.disposables.add(
      atom.config.observe("linter-todo.state", (value) => {
        this.state = value;
      }),
      atom.config.observe("linter-todo.extensions", (value) => {
        this.extensions = new Set(value);
      }),
      atom.config.observe("linter-todo.keywords", (value) => {
        this.keywords = value;
        this.buildRegex();
      }),
      atom.commands.add("atom-workspace", {
        "linter-todo:toggle-state": () => {
          atom.config.set("linter-todo.state", !this.state);
        },
        "linter-todo:lint-project": () => {
          indie.runScan();
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
      const keyword = match[1];
      const lineText = editor.lineTextForBufferRow(range.start.row);
      const afterKeyword = lineText.substring(range.end.column).trim();
      const beforeKeyword = lineText.substring(0, range.start.column).trim();
      const context = afterKeyword || beforeKeyword;
      const excerpt = context ? `${keyword}: ${context}` : keyword;

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
