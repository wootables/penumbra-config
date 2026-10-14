# Compare engine B (browser: infobox/subtitle) vs engine C (scheduler: email)
# for every corpus case, and print a divergence report.
$sp = $PSScriptRoot
$b = Get-Content "$sp\result_b.json" -Raw | ConvertFrom-Json
$c = Get-Content "$sp\result_c.json" -Raw | ConvertFrom-Json
# Engine A (the MAIN snippet area) joined 2026-08-29. It is optional so an old
# result set still compares: absent file = the A section is skipped, not an error.
$a = $null
if (Test-Path "$sp\result_a.json") { $a = Get-Content "$sp\result_a.json" -Raw | ConvertFrom-Json }

# Engine C wraps its output in the email's styled container; engine B returns the
# bare fragment. Strip that wrapper so we compare like with like.
function Strip-CWrapper([string]$s) {
    if ($null -eq $s) { return $null }
    $t = $s.Trim()
    $t = [regex]::Replace($t, '^<div style="font-size:\s*12px;[^"]*">', '')
    if ($t.EndsWith('</div>')) { $t = $t.Substring(0, $t.Length - 6) }
    return $t.Trim()
}
function Norm([string]$s) {
    if ($null -eq $s) { return '' }
    return ([regex]::Replace($s, '\s+', ' ')).Trim()
}

# sparkline() emits class-based <i> bars in the browser and pixel-sized nested
# tables in email - the same deliberate split progress_bar makes, so a raw string
# compare would just be allowlisted and prove nothing about it.
#
# What actually has to agree is the MATHS: the same series, bucketed the same
# way, rounded to the same pixel heights. So reduce each engine's output to its
# sequence of bar heights and compare THAT. A drift in the series, the bucketing
# or the JS-vs-PHP rounding rule fails here; a difference in wrapper markup does
# not, which is exactly the line we want to draw.
function SparkHeights([string]$s) {
    if ($null -eq $s) { return $null }
    # Browser engines (A/B): <i class="pnb-spark-bar..." style="height:14px;...">
    $m = [regex]::Matches($s, 'pnb-spark-bar[^>]*?height:(\d+)px')
    if ($m.Count -eq 0) {
        # Engine C: the inner bar cell carries height="14" as an attribute.
        # ANY width: the bar width is fitted to the point count now, so a
        # hard-coded 3 would match nothing and quietly compare two empty lists.
        $m = [regex]::Matches($s, '<td[^>]*\bwidth="\d+"[^>]*\bheight="(\d+)"')
    }
    if ($m.Count -eq 0) { return $null }
    return (($m | ForEach-Object { $_.Groups[1].Value }) -join ',')
}

# Cases that differ for a KNOWN, accepted reason. Listing them here keeps the
# report actionable: anything printed under DIVERGENCES is a genuine finding.
$expected = @{
  'progress_bar_2arg' = 'BY DESIGN: email needs <table> + inline CSS; the browser uses <div class=...>.'
  'progress_bar_thirds' = 'BY DESIGN: same div-vs-table split as progress_bar_2arg. Kept as a NON-ROUND percentage (1/3) - it is what proved the label difference was only a trailing zero, since all three engines already agreed at 33.3%.'

  # me() - BY DESIGN and permanently so: engine C returns a {PLACEHOLDER} that
  # $applyRecipientVars substitutes per recipient AFTER the snippet has run, so a
  # browser value and an email value can never match. What these cases DO assert is
  # that C emits the right token per attribute (_snippet_me's attrMap - note it
  # renames unityid to USERNAME) and that A == B on the resolved values.
  'me_fname'   = 'BY DESIGN: C emits {FNAME} for per-recipient substitution; A and B resolve the live value.'
  'me_lname'   = 'BY DESIGN: C emits {LNAME}.'
  'me_email'   = 'BY DESIGN: C emits {EMAIL}.'
  'me_unityid' = 'BY DESIGN: C emits {USERNAME} - the attrMap renames unityid.'
  'me_default' = 'BY DESIGN: a bare me() defaults to fname in all three; C emits {FNAME}.'

  # data(nosuchkey): as of 2026-08-29 A and B BOTH say ''undefined'' - the two browser
  # engines now agree, and it is the same sentinel all three already return for an
  # out-of-range data(promptN). Engine C deliberately stays EMPTY: server-side an
  # unknown key is usually a browser-only one (theme, density, colorder) that is
  # documented as empty, and an email reading ''undefined'' where the screen shows a
  # theme would be worse than a blank.
  'data_unknown_key' = 'BY DESIGN: A and B both say ''undefined'' (the browser engines agree); C stays empty because a key it does not recognise is usually a browser-only one it is documented to blank.'
  'sum_scope_all'     = 'NOT HARNESS-VERIFIABLE: B''s `all` scope reads module-level masterRowData, empty with no report loaded. LIVE-VERIFIED OK 2026-08-18 on ?id=epa-perm (subtitle count(, all) = 778 = full row count, matching C''s full-rowset value).'
  # 'string_upper' left this list 2026-09-18: _snippet_string() now names an unknown op the way
  # PenumbraTemplate.stringOp does ([Error: Invalid string type: upper]) instead of handing the
  # text back, so B and C agree on malformed input too. Every string() op is diffed directly,
  # byte for byte, by ..\tplparity.
  'progress_bar'      = 'KNOWN (low): malformed input only (missing 2nd arg) - B errors, C emits nothing.'
}

# Cases that diverge because of a REAL, TRIAGED, UNFIXED engine defect. These are
# pinned separately from $expected so that (a) they never masquerade as "by
# design", and (b) they cannot mask a NEW regression in the DIVERGENT section.
# Delete an entry the moment its bug is fixed - the case then has to go green.
$openBugs = @{
  # EMPTY as of 2026-08-29 - every pinned defect has been fixed:
  #   date_diff DST off-by-one          -> schedule_runner.php.bak-20260829-datediffdst
  #   \x02 guard was per-boundary        -> schedule_runner.php.bak-20260829-guardspan
  #   rank()/lookup() dropped N/A text   -> schedule_runner.php.bak-20260829-naparity
  #   aggregates rounded at the handler  -> schedule_runner.php.bak-20260829-rawprecision
  # Keep this table: add 'case_id' = 'why' for any REAL defect you triage but do
  # not fix, so it cannot mask a new regression in DIVERGENT. Delete the entry
  # when the bug is fixed - the case then has to go green.
}

$cMap = @{}; foreach ($r in $c) { $cMap[$r.id] = $r }

# SWALLOWED errors (2026-09-19). Engines B and C each have an internal catch that
# turns a Throwable into ordinary-looking output: B's `catch (e) { return m; }`
# hands the snippet back unresolved, C's `catch (\Throwable) { $result = ''; }`
# (execute_email_snippet / evaluate_custom_condition) hands back ''. Both runners
# record what those catches swallow per case, as `swallowed`. Read the message
# before believing a divergence on such a case: "Call to undefined function" means
# the HARNESS lacks a helper the real app loads - lookup_first_match read as
# B 1200.50 / C empty from 09-05 to 09-19 for exactly that reason - while anything
# else is an engine exception a real send would swallow too.
$swallowed = @(); $swMap = @{}
foreach ($r in $b) { if ($r.swallowed) { $swallowed += [pscustomobject]@{ engine='B'; id=$r.id; msg=(@($r.swallowed) -join ' | ') } } }
foreach ($r in $c) { if ($r.swallowed) { $swallowed += [pscustomobject]@{ engine='C'; id=$r.id; msg=(@($r.swallowed) -join ' | ') } } }
foreach ($s in $swallowed) { $swMap[$s.id] = (@($swMap[$s.id], ('{0}: {1}' -f $s.engine, $s.msg)) | Where-Object { $_ }) -join ' || ' }

$same = 0; $diff = @(); $errs = @(); $known = @(); $bugs = @(); $plainDiff = @()
foreach ($rb in $b) {
    $rc = $cMap[$rb.id]
    if ($null -eq $rc) { continue }
    if ($rb.error -or $rc.error) {
        $errs += [pscustomobject]@{ id=$rb.id; snippet=$rb.snippet; b_err=$rb.error; c_err=$rc.error }
        continue
    }
    $bo = Norm $rb.out
    $co = Norm (Strip-CWrapper $rc.out)

    # PLAIN-MODE CONSISTENCY. Engine B has a single mode, so nothing else here
    # can see engine C's $plainOutput path (report subtitle / by-line). Since
    # 2026-08-29 that path runs the SAME number pass as HTML mode and differs
    # only by the styled wrapper - which Strip-CWrapper already removes. So
    # plain must equal stripped-HTML for every case; combined with the B-vs-C
    # test below, that transitively pins plain output to the browser too.
    if ($null -ne $rc.out_plain) {
        $cp = Norm $rc.out_plain
        if ($cp -ne $co) {
            $plainDiff += [pscustomobject]@{ id=$rb.id; snippet=$rb.snippet; html=$co; plain=$cp }
        }
    }

    # sparkline: compare the bar-height sequence, not the wrapper markup.
    if ($rb.id -like 'sparkline*') {
        $bh = SparkHeights $bo
        $ch = SparkHeights $co
        if ($null -eq $bh -and $null -eq $ch) {
            # Neither drew bars - both should be the same error/empty string,
            # and that IS directly comparable, so fall through to the normal test.
        } else {
            if ($bh -eq $ch) { $same++ }
            else {
                $diff += [pscustomobject]@{ id=$rb.id; snippet=$rb.snippet
                                            B="heights[$bh]"; C="heights[$ch]" }
            }
            continue
        }
    }

    if ($bo -eq $co) { $same++ }
    elseif ($expected.ContainsKey($rb.id)) { $known += [pscustomobject]@{ id=$rb.id; why=$expected[$rb.id] } }
    elseif ($openBugs.ContainsKey($rb.id)) { $bugs += [pscustomobject]@{ id=$rb.id; snippet=$rb.snippet; why=$openBugs[$rb.id]; B=$bo; C=$co } }
    else { $diff += [pscustomobject]@{ id=$rb.id; snippet=$rb.snippet; B=$bo; C=$co } }
}

"==== PARITY: engine B (browser subtitle/infobox) vs engine C (scheduled email) ===="
"cases compared : {0}" -f ($same + $diff.Count + $known.Count + $bugs.Count)
"identical      : {0}" -f $same
"known/expected : {0}" -f $known.Count
"OPEN BUGS      : {0}   <-- triaged defects, pinned so they cannot mask a regression" -f $bugs.Count
"DIVERGENT      : {0}   <-- real findings" -f $diff.Count
"errors         : {0}" -f $errs.Count
"plain-mode drift: {0}   <-- engine C plain vs HTML output (wrapper aside)" -f $plainDiff.Count
"swallowed      : {0}   <-- an engine's own catch hid a Throwable; read these before trusting DIVERGENT" -f $swallowed.Count
""
if ($swallowed.Count) {
  "---- SWALLOWED (an engine's own catch turned a Throwable into output) ----"
  $swallowed | ForEach-Object { "  [{0}] engine {1}: {2}" -f $_.id, $_.engine, $_.msg }
  ""
}
if ($known.Count) { "---- known / accepted (not findings) ----"; $known | ForEach-Object { "  [{0}] {1}" -f $_.id, $_.why }; "" }
if ($plainDiff.Count) {
  "---- PLAIN-MODE DRIFT (engine C only: subtitle path disagrees with HTML path) ----"
  $plainDiff | ForEach-Object {
    "  [{0}]  {1}" -f $_.id, $_.snippet
    "      html : {0}" -f $(if ($_.html.Length -gt 130) { $_.html.Substring(0,130)+'...' } else { $_.html })
    "      plain: {0}" -f $(if ($_.plain.Length -gt 130) { $_.plain.Substring(0,130)+'...' } else { $_.plain })
  }
  ""
}
if ($bugs.Count) {
  "---- OPEN BUGS (triaged, unfixed - NOT new findings) ----"
  $bugs | ForEach-Object {
    "  [{0}]  {1}" -f $_.id, $_.snippet
    "      B: {0}" -f $_.B
    "      C: {0}" -f $_.C
    "      why: {0}" -f $_.why
  }
  ""
}
if ($errs.Count) { "---- ERRORS ----"; $errs | ForEach-Object { "[{0}] {1}`n   B: {2}`n   C: {3}" -f $_.id, $_.snippet, $_.b_err, $_.c_err }; "" }
if ($diff.Count) {
  "---- DIVERGENCES ----"
  $diff | ForEach-Object {
    "[{0}]  {1}" -f $_.id, $_.snippet
    "    B (browser): {0}" -f $(if ($_.B.Length -gt 150) { $_.B.Substring(0,150)+'...' } else { $_.B })
    "    C (email)  : {0}" -f $(if ($_.C.Length -gt 150) { $_.C.Substring(0,150)+'...' } else { $_.C })
    if ($swMap.ContainsKey($_.id)) { "    swallowed  : {0}" -f $swMap[$_.id] }
  }
}

# ============================================================================
# ENGINE A vs ENGINE B - the main snippet area against the infobox/subtitle one.
# Both are in-browser, so unlike B-vs-C there is no email/HTML split to excuse a
# difference: anything here is either a deliberate presentation choice or a bug.
# A's output has been through DOMPurify (main.js ~36641) and B's has not, so
# markup-level differences are possible in principle - none observed so far.
# ============================================================================
$expectedAB = @{
  'string_upper' = 'BY DESIGN (cosmetic, malformed input only): A wraps its error text in single quotes, B does not. Valid string() ops agree.'
}
$openBugsAB = @{
  # EMPTY - every A-vs-B finding has been resolved:
  #   calc() rejected scientific notation    -> js/main.js.bak-20260829-calcexp
  #   progress_bar label kept a trailing 0   -> js/main.js.bak-20260829-pbarlabel
  #   data(unknownkey) returned empty in B   -> js/main.js.bak-20260829-dataunknown
  # Add 'case_id' = 'why' here for any REAL A-vs-B defect you triage but do not fix.
}

if ($null -ne $a) {
    $bMap = @{}; foreach ($r in $b) { $bMap[$r.id] = $r }
    $abSame = 0; $abDiff = @(); $abKnown = @(); $abBugs = @(); $abErrs = @()
    foreach ($ra in $a) {
        $rb = $bMap[$ra.id]
        if ($null -eq $rb) { continue }
        if ($ra.error -or $rb.error) { $abErrs += [pscustomobject]@{ id=$ra.id; a_err=$ra.error; b_err=$rb.error }; continue }
        $ao = Norm $ra.out
        $bo2 = Norm $rb.out
        if ($ao -eq $bo2) { $abSame++ }
        elseif ($expectedAB.ContainsKey($ra.id)) { $abKnown += [pscustomobject]@{ id=$ra.id; why=$expectedAB[$ra.id] } }
        elseif ($openBugsAB.ContainsKey($ra.id)) { $abBugs += [pscustomobject]@{ id=$ra.id; snippet=$ra.snippet; why=$openBugsAB[$ra.id]; A=$ao; B=$bo2 } }
        else { $abDiff += [pscustomobject]@{ id=$ra.id; snippet=$ra.snippet; A=$ao; B=$bo2 } }
    }
    ""
    "==== PARITY: engine A (main snippet area) vs engine B (subtitle/infobox) ===="
    "cases compared : {0}" -f ($abSame + $abDiff.Count + $abKnown.Count + $abBugs.Count)
    "identical      : {0}" -f $abSame
    "known/expected : {0}" -f $abKnown.Count
    "OPEN BUGS      : {0}   <-- triaged defects, pinned so they cannot mask a regression" -f $abBugs.Count
    "DIVERGENT      : {0}   <-- real findings" -f $abDiff.Count
    "errors         : {0}" -f $abErrs.Count
    ""
    if ($abKnown.Count) { "---- known / accepted (not findings) ----"; $abKnown | ForEach-Object { "  [{0}] {1}" -f $_.id, $_.why }; "" }
    if ($abBugs.Count) {
      "---- OPEN BUGS (triaged, unfixed - NOT new findings) ----"
      $abBugs | ForEach-Object {
        "  [{0}]  {1}" -f $_.id, $_.snippet
        "      A: {0}" -f $_.A
        "      B: {0}" -f $_.B
        "      why: {0}" -f $_.why
      }
      ""
    }
    if ($abErrs.Count) { "---- ERRORS ----"; $abErrs | ForEach-Object { "[{0}] A: {1} | B: {2}" -f $_.id, $_.a_err, $_.b_err }; "" }
    if ($abDiff.Count) {
      "---- DIVERGENCES ----"
      $abDiff | ForEach-Object {
        "[{0}]  {1}" -f $_.id, $_.snippet
        "    A (main snippet): {0}" -f $(if ($_.A.Length -gt 150) { $_.A.Substring(0,150)+'...' } else { $_.A })
        "    B (subtitle/box): {0}" -f $(if ($_.B.Length -gt 150) { $_.B.Substring(0,150)+'...' } else { $_.B })
      }
    }
} else {
    ""
    "(engine A not compared - result_a.json absent; run run_parity.ps1 to generate it)"
}
