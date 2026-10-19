# sftpkey - the SFTP/SCP private key of a Drop-a-File task at rest (2026-10-16)

The help-accuracy audit of 2026-10-15 found that a Drop-a-File task's SSH private key
(`OPTIONS.drop_sftp_key`) was stored exactly as pasted, returned to the browser by every task
list, re-posted by the form and loaded raw by the transport, while `drop_password` and the two
S3 keys were AES-256-CBC encrypted and stripped. This change makes the key a secret like the
password. Staged and tested on 2026-10-16; **not deployed** until the user says so.

## Files here

| File | What |
|---|---|
| `patch.php` | THE CHANGE, as data: `php -n patch.php --from=<tree> --to=<stage>` copies each touched file and applies 29 exact-anchor edits (an anchor that is not found exactly once fails that file). Re-run it against a fresh copy of live at deploy time if live moved. Also copies the whole `help/` tree (the helpv2 lint wants every fragment; switch markers dropped) and installs the CLI from `files/`. |
| `files/encrypt_sftp_keys_cli.php` | NEW, goes to the webroot root beside `purge_report_cli.php`: the one-off migration (dry run by default, `--commit` to write, `--task=<id>` for one). Row-locked, round trip proven before and after the write, one `SCHEDULE_UPDATE` audit row per task (ciphertext on both sides, never the key). |
| `test_sftpkey.php` | 79 checks over the real code (lifted by tokenizer; the transport is require'd from a scratch copy). `--control`, `--mutant=<name>`. C8 and R4 (a value read under the WRONG secret) are IV-proof since 2026-10-17: AES-CBC has no tag, so ~1 wrong-secret decrypt in 256 returns garbage and the old single-sample `=== false` checks went red about 1 run in 125 - C8 now counts 32 fresh IVs (the key never comes back, most are false), R4 draws a fixture the suite secret really rejects. |
| `run.ps1` | lint (php -n -l + a broken-file control) then the test; `-Mutants` runs the four mutants with exact counts. |

## What changed (per file, all in `patch.php`)

- `db_connection.php` - shared helpers, guarded like the other scheduler helpers:
  `penumbraSchedulerSecretIsStored()` (the stored shape: base64 of `<base64 ciphertext>::<16-byte IV>`),
  `penumbraSchedulerSecretEncrypt()` / `Decrypt()` (the save path's algorithm), and
  `penumbraSchedulerEncryptPlainSftpKey($options, $secret)` -> `[$options, $changed]`, the normaliser
  every writer runs so a plaintext key never reaches the table again.
- `manage_schedule.php` - list: `drop_sftp_key` nulled, `has_drop_sftp_key` sent (the password's pattern).
  Save: `penumbra_sched_apply_sftp_key($options, $posted, $remove, $existing)` (pure): the key is its own
  POST field `drop_sftp_key`, encrypted with `encrypt_scheduler_password()`; blank keeps the stored key
  whatever `preserve_drop_secrets` says, and a kept key still stored as pasted is encrypted on that save
  (migration on save, the update's audit row says so); `drop_sftp_key_remove=true` drops it; an OLDER
  main.js still posting the key inside `options` is consumed and encrypted. The BEFORE snapshot of an
  update, the draft-test audit and a restore from an audit snapshot never carry a plaintext key.
- `schedule_runner.php` - `scheduler_read_sftp_key($options)` -> `[$plain, $error, $legacy]`: decrypts
  the stored key into `_decrypted_sftp_key`; a key still stored as pasted is used as it is and logged as a
  Notice per run; a stored value that does not decrypt stops the task like a bad password.
- `plugins/file_transport.php` - SFTP and SCP read ONLY `_decrypted_sftp_key` (`_penumbra_drop_sftp_key()`);
  a stored key the caller did not decrypt is refused BEFORE phpseclib loads or a host is dialled.
- `get_audit_data.php` - masks `drop_sftp_key` on both sides: `(encrypted)` for a stored value,
  `(stored unencrypted, not shown)` for a snapshot from before the change (so a migration row reads as a
  real change in the Auditor).
- `index.php` + `js/main.js` - the "Key saved. Leave blank to keep." notice under the Private Key textarea
  with a "Remove the saved key" link (the removed state tells the user what the save will do); the form
  reload never fills the textarea; the key left the options JSON and is posted on its own, trimmed;
  `preserve_drop_secrets` counts the key notice.
- `help/topics/schedulerHelpLightbox.php` - the Security and Credentials paragraphs and the "Which to
  use" Credentials cell (paragraphs within the 80-word lint budget).
- `README.md` - a section-3 tests entry, a section-5 landmine, a section-6 open item (old audit rows).

## Run

```powershell
$d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sftpkey'
& ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <stage> -Mutants
& ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <stage> -Control    # FAIL: 1
& ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants                 # live, after the deploy
```

Build a stage: copy the touched files (and `help/`) from live to `<orig>`, then
`php.exe -n patch.php --from=<orig> --to=<stage>`. Neighbouring suites to run on the stage:
`cronnever` (manage + runner cron functions) and the helpv2 lint
(`lint_help.php --app=<stage> --live=<webroot>`; L13 and L20 are red on a partial stage because the
shims and `help_ask.php` are not under `--app` - they pass on live; L16 is the word budget and matters).
`dropdest` hardcodes the live tree (run it after the deploy).

Mutants and their exact counts (2026-10-16): `plainsave` 5, `rawkey` 3, `nostrip` 1, `nodecrypt` 2.

## Deploy notes (for the atomic recipe)

1. Order: `db_connection.php` first (the helpers), pause, then `manage_schedule.php`,
   `schedule_runner.php`, `plugins/file_transport.php`, `get_audit_data.php`, `index.php`, `js/main.js`,
   the help topic, `encrypt_sftp_keys_cli.php` (new), `README.md`.
2. TIME IT right after a scheduler cycle's "Run Complete": an OLD runner mid-cycle lazy-loading the NEW
   transport would have a stored key refused for that one drop (the guard). Runner and transport in the
   same window.
3. Before the swap: `git status --porcelain` must be EMPTY for every target. On 2026-10-16 10:30 the live
   `help/topics/schedulerHelpLightbox.php` and `README.md` were dirty (another session's uncommitted swap,
   the help-accuracy patch) - wait for that commit, then re-stage those two from the then-current live
   (`patch.php` re-applies; its anchors are the post-audit sentences).
4. After the swap: run this suite against live, then the migration - ON THE SERVER, from an ELEVATED
   prompt (the config's secrets are sealed with `C:\inetpub\penumbra_config.key`, readable by
   Administrators / SYSTEM / IUSR only, and that key is server-local by design, so the CLI cannot run from
   a workstation even with oci8 loaded from the share - proven 2026-10-17):
   `D:\Utilities\PHP_8.2-p\php.exe C:\inetpub\wwwroot\sponsor_migration\penumbra\encrypt_sftp_keys_cli.php`
   (dry run: every task's key state, never a value), then the same command with `--commit`. Until it runs,
   each Drop-a-File run with a key stored as pasted logs a Notice in `log/scheduler_<date>.log`.
   `work/probe_sftpkey_dryrun.php` is the fallback for a dry run without a server shell: copied into the
   webroot for one call with its one-time token (X-Probe-Token header) through a signed-in browser session
   on the proxy host (direct off-proxy HTTPS to oitras answers 403), then deleted. SELECT only.
5. Browsers pick up the new `main.js` by its `?v=filemtime` query. An old tab saving a task is safe: the
   server keeps a stored key when the posted field is blank and encrypts a key posted inside `options`.

## Residual

Audit rows written before the change carry the key as pasted in their BEFORE/AFTER snapshots (masked
on the way to the browser; the rows are not rewritten) - README section 6 lists it.
