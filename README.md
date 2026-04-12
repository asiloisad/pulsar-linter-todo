# linter-todo

Scans files for TODO-style keywords and reports them as info-level linter messages. Uses the same default keywords as the built-in `language-todo` package.

## Installation

To install `linter-todo` search for [linter-todo](https://web.pulsar-edit.dev/packages/linter-todo) in the Install pane of the Pulsar settings or run `ppm install linter-todo`. Alternatively, you can run `ppm install asiloisad/pulsar-linter-todo` to install a package directly from the GitHub repository.

## Keywords

The following keywords are detected by default: `TODO`, `FIXME`, `CHANGED`, `XXX`, `IDEA`, `HACK`, `NOTE`, `REVIEW`, `NB`, `BUG`, `QUESTION`, `COMBAK`, `TEMP`, `DEBUG`, `OPTIMIZE`, `WARNING`.

## Commands

Commands available in `atom-workspace`:

- `linter-todo:toggle-state`: toggle config of linter state,
- `linter-todo:lint-project`: scan entire project for TODO keywords.

## Settings

- **Linter state**: enable or disable the linter,
- **Keywords**: list of TODO-style keywords to detect.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
