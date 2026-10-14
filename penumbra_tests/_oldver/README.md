# _oldver - old file versions for -Control runs, from git

Since 2026-10-14 Penumbra deploys make **no `<file>.bak-<stamp>` copies**: every deploy is a git
commit (`d:\Utilities\penumbra_git`, pushed to the private GitHub repo), so git holds the previous
version. The in-tree `.bak` files were moved out of the webroot the same day.

Suites whose control mode used to glob the webroot for `<APP>\js\main.js.bak-*-<tag>` now call a
drop-in with the SAME pattern:

| Language   | Load                                                                     | Glob (newest = last)        | One exact path          | File at a commit                     |
|------------|--------------------------------------------------------------------------|-----------------------------|-------------------------|--------------------------------------|
| Python     | `sys.path.insert(0, r'...\_oldver'); from oldver import bak_glob, bak_path, git_show` | `bak_glob(pat)`  | `bak_path(p)`           | `git_show('abc1234^', 'js/main.js')` |
| PowerShell | `. ([scriptblock]::Create([IO.File]::ReadAllText('...\_oldver\oldver.ps1')))` | `Get-BakItem $pat`     | `Resolve-Bak $p`        | `Get-GitVersion 'abc1234^' 'js\main.js'` |
| PHP        | `require_once '...\_oldver\oldver.php';`                                 | `oldver_glob($pat)`         | `oldver_path($p)`       | `oldver_git_show('abc1234^', 'js/main.js')` |

(The share is MachinePolicy RemoteSigned, so the PowerShell helper loads as a scriptblock, like the suites.)

Lookup order: real files matching the pattern (webroot, stage dir, ...), then `bak_index.tsv`:

- `git`  - the .bak's bytes are a blob in git; written once to `cache\<sha>\<original .bak name>`
           (the name is kept, so checks like `startswith('main.js.bak-')` still work). Every blob
           is hash-checked on the way out.
- `file` - a plain path. None left since 2026-10-14: the .bak files no commit ever held (47
           intermediate live versions + 217 pre-git ones a suite names) were committed to the git
           branch **`bak-archive`** (pushed to GitHub) at their webroot paths. **Never delete that
           branch** - index entries point at its blobs. Neither `c:\inetpub\penumbra_debloat_*`
           folder is needed by anything here.

A .bak that turns up later: if `git cat-file -e <its blob sha>` fails, add it to `bak-archive`
(temp `GIT_INDEX_FILE`, `read-tree bak-archive`, `update-index --add`, `commit-tree -p bak-archive`,
`update-ref`, push) - never through the live index - then append `<rel>\tgit\t<sha>` here.

## New suites

There is no .bak to name any more. Take the commit instead: the build before commit `X` is
`git_show('X^', '<rel>')`. Write the commit id into the suite header where the .bak stamp used to go.

`cache\` can be deleted at any time; it refills on demand.
