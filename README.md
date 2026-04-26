# linter-todo

Scans files for TODO-style keywords and reports them as info-level linter messages. Uses the same default keywords as the built-in `language-todo` package.

## Installation

To install `linter-todo` search for [linter-todo](https://web.pulsar-edit.dev/packages/linter-todo) in the Install pane of the Pulsar settings or run `ppm install linter-todo`. Alternatively, you can run `ppm install asiloisad/pulsar-linter-todo` to install a package directly from the GitHub repository.

## Keywords

The following keywords are detected by default: `TODO`, `FIXME`, `CHANGED`, `XXX`, `IDEA`, `HACK`, `NOTE`, `REVIEW`, `NB`, `BUG`, `QUESTION`, `COMBAK`, `TEMP`, `DEBUG`, `OPTIMIZE`, `WARNING`.

## Comment detection

Both scan modes restrict matches to comment regions only, consistent with the built-in `language-todo` package.

**Editor scan** uses Pulsar's tokenizer: a match is accepted only if its scope descriptor includes a `comment` scope or the file root is `text.plain`. This works for any language with a grammar loaded.

**Project scan** uses hardcoded comment syntax per file extension, since no tokenizer is available for files not open in the editor. Single-line and block comment markers are defined for all built-in extensions. Plain text files (`.txt`) are accepted in full. Files with no known comment syntax (e.g. `.json`, `.md`) produce no matches. Supported extensions: `.c` `.cpp` `.h` `.hpp` `.cs` `.java` `.js` `.ts` `.jsx` `.tsx` `.vue` `.svelte` `.astro` `.html` `.css` `.scss` `.less` `.xml` `.py` `.ipy` `.rb` `.pl` `.pm` `.sh` `.bash` `.zsh` `.ps1` `.bat` `.cmd` `.go` `.rs` `.swift` `.kt` `.dart` `.scala` `.hs` `.ml` `.el` `.clj` `.ex` `.exs` `.erl` `.yaml` `.yml` `.toml` `.cfg` `.ini` `.conf` `.sql` `.lua` `.r` `.m` `.tex` `.vim` `.coffee` `.cson` `.dat` `.gra` `.grb` `.txt`.

## Commands

Commands available in `atom-workspace`:

- `linter-todo:toggle-state`: toggle config of linter state,
- `linter-todo:lint-project`: scan entire project for TODO keywords.

## Settings

- **Linter state**: enable or disable the linter,
- **Keywords**: list of TODO-style keywords to detect.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
