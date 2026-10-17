<?php
/**
 * patch_helphash.php - Help Center deep link with a section anchor: #help=<topic>:<anchor>
 * (2026-10-16).
 *
 *   php -n patch_helphash.php --file <js/main.js> [--check]
 *
 * ONE hunk, byte-safe (CRLF kept, exact anchor text, applied once; --check only reports):
 * the boot-time `_helpHash` block of main.js (under the "Deep link: index.php#help" comment)
 * also reads an optional heading id after a colon and hands it to openHelpCenter() as the
 * jump anchor, so a hub link from the dashboard's help panel lands on its data-jump-to
 * heading. With it: the topic id resolves through _helpTocItemFor (data-topic OR a folded
 * data-extra id, both server-rendered, so an alias such as accessListHelpLightbox opens its
 * host topic instead of the general one), a malformed percent-escape no longer throws out
 * of the ready handler, and the search box is focused only for a stray id WITHOUT an anchor
 * (activateHelpTopic re-resolves an anchor's owner topic, so the anchor still lands).
 *
 * Other sessions stage main.js too: re-run this on the CURRENT live copy right before a
 * deploy (the anchor text is the block itself, which none of them touch); "already present"
 * means the copy carries the hunk.
 */
$o = getopt('', array('file:', 'check'));
if (empty($o['file'])) { fwrite(STDERR, "usage: --file <main.js> [--check]\n"); exit(2); }
$path = $o['file'];
$s = file_get_contents($path);
if ($s === false) { fwrite(STDERR, "cannot read $path\n"); exit(2); }
$crBefore = substr_count($s, "\r");
$eol = "\r\n";
$marker = '#help=<topicId>:<anchorId> (2026-10-16)';
if (strpos($s, $marker) !== false) { echo "hunk already present\n"; echo "CR $crBefore -> $crBefore (0 new lines)\n"; exit(0); }

$old = "    var _helpHash = String(window.location.hash || '');" . $eol
     . "    if (_helpHash === '#help' || _helpHash.indexOf('#help=') === 0) {" . $eol
     . "        var _helpTopic = _helpHash.indexOf('#help=') === 0 ? decodeURIComponent(_helpHash.substring(6)) : '';" . $eol
     . "        var _helpOk = /^[A-Za-z0-9_-]+$/.test(_helpTopic) &&" . $eol
     . "                      \$('#helpCenterToc .help-toc-item').filter(function () { return String(\$(this).data('topic')) === _helpTopic; }).length > 0;" . $eol
     . "        setTimeout(function () { openHelpCenter(_helpOk ? _helpTopic : 'whatIsPenumbraLightbox', '', !_helpOk); }, 250);" . $eol
     . "    }" . $eol;
$n = substr_count($s, $old);
if ($n !== 1) { fwrite(STDERR, "hash block found $n times (expected exactly 1): main.js drifted, patch by hand\n"); exit(2); }
// _helpTocItemFor must be in scope (same closure, defined above the block).
if (substr_count($s, "    function _helpTocItemFor(fragId) {" . $eol) !== 1) { fwrite(STDERR, "_helpTocItemFor not found exactly once\n"); exit(2); }

$new = "    var _helpHash = String(window.location.hash || '');" . $eol
     . "    if (_helpHash === '#help' || _helpHash.indexOf('#help=') === 0) {" . $eol
     . "        // #help=<topicId>:<anchorId> (2026-10-16): an optional heading id after a colon, so a" . $eol
     . "        // hub link from the dashboard's help panel lands on its section (its data-jump-to)." . $eol
     . "        // Both ids are strict. The anchor rides to activateHelpTopic, whose owner re-resolution" . $eol
     . "        // lands on the anchor's topic even when the id before the colon is stale; a folded id" . $eol
     . "        // (a data-extra of a TOC item) is a topic too. A bad percent-escape is a stray id." . $eol
     . "        var _helpSpec = '';" . $eol
     . "        try { _helpSpec = _helpHash.indexOf('#help=') === 0 ? decodeURIComponent(_helpHash.substring(6)) : ''; } catch (_helpErr) { _helpSpec = ''; }" . $eol
     . "        var _helpColon = _helpSpec.indexOf(':');" . $eol
     . "        var _helpTopic = _helpColon === -1 ? _helpSpec : _helpSpec.substring(0, _helpColon);" . $eol
     . "        var _helpAnchor = _helpColon === -1 ? '' : _helpSpec.substring(_helpColon + 1);" . $eol
     . "        if (!/^[A-Za-z0-9_-]+$/.test(_helpAnchor)) _helpAnchor = '';" . $eol
     . "        var _helpOk = /^[A-Za-z0-9_-]+$/.test(_helpTopic) && _helpTocItemFor(_helpTopic).length > 0;" . $eol
     . "        setTimeout(function () { openHelpCenter(_helpOk ? _helpTopic : 'whatIsPenumbraLightbox', _helpAnchor, !_helpOk && !_helpAnchor); }, 250);" . $eol
     . "    }" . $eol;

if (isset($o['check'])) {
    echo "hunk (hash block anchor): would apply\n";
    echo "CR $crBefore -> " . ($crBefore + substr_count($new, "\r") - substr_count($old, "\r")) . "\n";
    exit(0);
}
$s = str_replace($old, $new, $s);
if (file_put_contents($path, $s) === false) { fwrite(STDERR, "cannot write $path\n"); exit(2); }
$crAfter = substr_count($s, "\r");
echo "hunk (hash block anchor): applied\n";
echo "CR $crBefore -> $crAfter (" . ($crAfter - $crBefore) . " new lines)\n";
