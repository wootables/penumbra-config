<?php
/**
 * patch_mainjs.php - Help Center: make jump links and deep links work ACROSS topics.
 *
 *   php patch_mainjs.php --file <stage js/main.js> [--check]
 *
 * Two hunks, byte-safe (CRLF kept, exact anchors, each applied once; --check only reports).
 *
 *  1. The `.help-jump-link` click handler: a link whose target heading lives in a topic that
 *     is not active (display:none) used to scroll to nothing. Now it activates the owning
 *     topic (through activateHelpTopic, which also scrolls to the heading) and stops.
 *  2. activateHelpTopic(fragId, jumpTo):
 *     - a jump anchor that lives in another topic re-resolves the topic to that owner, so a
 *       "?" icon or openHelpCenter() call aimed at a section that moved keeps landing on it
 *       (the 2026-10-14 split of the SQL Editor topic relies on this);
 *     - opening a FOLDED topic (an id that is only an `extra` of a TOC item) with no jump
 *       anchor scrolls to that fragment's start instead of the host topic's top;
 *     - the anchor lookup accepts the topic div itself, not only its descendants.
 */
$o = getopt('', array('file:', 'check'));
if (empty($o['file'])) { fwrite(STDERR, "usage: --file <main.js> [--check]\n"); exit(2); }
$path = $o['file'];
$s = file_get_contents($path);
if ($s === false) { fwrite(STDERR, "cannot read $path\n"); exit(2); }
$crBefore = substr_count($s, "\r");
$eol = "\r\n";
$changed = 0;

// ---------------------------------------------------------------- hunk 1
$marker1 = '// Cross-topic jump (2026-10-14):';
if (strpos($s, $marker1) === false) {
    $anchor = "        const \$target = \$scrollContainer.find('#' + targetId);" . $eol;
    $n = substr_count($s, $anchor);
    if ($n !== 1) { fwrite(STDERR, "hunk 1 anchor found $n times\n"); exit(2); }
    $insert = $anchor
        . "        // Cross-topic jump (2026-10-14): the heading lives in a topic that is display:none" . $eol
        . "        // until it is activated, so scrolling here would land on nothing. Activate its" . $eol
        . "        // owner instead - activateHelpTopic scrolls to the heading itself - and stop." . $eol
        . "        if (\$scrollContainer.is('#helpCenterContent') && \$target.length && typeof window.activateHelpTopic === 'function') {" . $eol
        . "            var \$jumpOwner = \$target.closest('.help-topic');" . $eol
        . "            if (\$jumpOwner.length && !\$jumpOwner.hasClass('is-active')) {" . $eol
        . "                window.activateHelpTopic(\$jumpOwner.attr('id'), targetId);" . $eol
        . "                return;" . $eol
        . "            }" . $eol
        . "        }" . $eol;
    if (!isset($o['check'])) $s = str_replace($anchor, $insert, $s);
    $changed++;
    echo "hunk 1 (.help-jump-link cross-topic): " . (isset($o['check']) ? 'would apply' : 'applied') . "\n";
} else {
    echo "hunk 1 already present\n";
}

// ---------------------------------------------------------------- hunk 2
$marker2 = '// Owner re-resolution (2026-10-14):';
if (strpos($s, $marker2) === false) {
    $start = "    function activateHelpTopic(fragId, jumpTo) {" . $eol;
    $end   = "    window.activateHelpTopic = activateHelpTopic;" . $eol;
    $p1 = strpos($s, $start); $p2 = strpos($s, $end);
    if ($p1 === false || $p2 === false || $p2 < $p1 || substr_count($s, $start) !== 1 || substr_count($s, $end) !== 1) { fwrite(STDERR, "hunk 2 anchors not unique\n"); exit(2); }
    $old = substr($s, $p1, $p2 - $p1);
    // The function we expect to be replacing (guards against a drifted main.js).
    foreach (array("var \$item = _helpTocItemFor(fragId);", "var \$j = \$pane.find('.help-topic.is-active').find('#' + jumpTo);", "if (_helpSearchQuery) _highlightActiveTopic(_helpSearchQuery);") as $must) {
        if (strpos($old, $must) === false) { fwrite(STDERR, "hunk 2: expected line missing: $must\n"); exit(2); }
    }
    $new = $start
        . "        var \$pane = \$('#helpCenterContent');" . $eol
        . "        if (!\$pane.length) return;" . $eol
        . "        var \$item = _helpTocItemFor(fragId);" . $eol
        . "        // Owner re-resolution (2026-10-14): a jump anchor that lives in ANOTHER topic wins" . $eol
        . "        // over fragId, so a \"?\" icon or openHelpCenter() aimed at a section that moved to a" . $eol
        . "        // topic of its own (the SQL Editor split) keeps landing on that section." . $eol
        . "        if (jumpTo) {" . $eol
        . "            var \$anchorOwner = \$pane.find('#' + jumpTo).first().closest('.help-topic');" . $eol
        . "            if (\$anchorOwner.length) {" . $eol
        . "                var \$ownerItem = _helpTocItemFor(\$anchorOwner.attr('id'));" . $eol
        . "                if (\$ownerItem.length) \$item = \$ownerItem;" . $eol
        . "            }" . $eol
        . "        }" . $eol
        . "        if (!\$item.length) \$item = \$('#helpCenterToc .help-toc-item').first();" . $eol
        . "        var topicId = \$item.data('topic');" . $eol
        . "        var extras = (\$item.attr('data-extra') || '').split(/\\s+/).filter(Boolean);" . $eol
        . "        // A folded topic (an id that is only an extra of this item) opened with no anchor:" . $eol
        . "        // land on that fragment's start, not on the host topic's top." . $eol
        . "        if (!jumpTo && fragId && fragId !== topicId && extras.indexOf(fragId) !== -1) jumpTo = fragId;" . $eol
        . $eol
        . "        \$('#helpCenterToc .help-toc-item').removeClass('is-active');" . $eol
        . "        \$item.addClass('is-active');" . $eol
        . "        _scrollTocToActive();" . $eol
        . $eol
        . "        _clearHelpHighlights();" . $eol
        . "        \$pane.find('.help-topic').removeClass('is-active');" . $eol
        . "        var \$main = \$('#' + topicId).addClass('is-active');" . $eol
        . "        extras.forEach(function (id) { \$('#' + id).addClass('is-active'); });" . $eol
        . $eol
        . "        // Scroll to a sub-anchor if requested (data-jump-to). The anchor may be a heading" . $eol
        . "        // inside an active topic or an active topic's own div. Otherwise, if a search is" . $eol
        . "        // active, _highlightActiveTopic() (below) scrolls to the first match; if not, jump to the top." . $eol
        . "        if (jumpTo) {" . $eol
        . "            var \$j = \$pane.find('#' + jumpTo).filter(function () { return \$(this).closest('.help-topic').hasClass('is-active'); }).first();" . $eol
        . "            if (\$j.length) { _scrollHelpPaneTo(\$j); }" . $eol
        . "            else { \$pane.stop().animate({ scrollTop: 0 }, 250); }" . $eol
        . "        } else if (!_helpSearchQuery) {" . $eol
        . "            \$pane.stop().animate({ scrollTop: 0 }, 250);" . $eol
        . "        }" . $eol
        . $eol
        . "        // Pulse the pane so the user sees where the trigger dropped them." . $eol
        . "        \$pane.removeClass('is-pulsing');" . $eol
        . "        if (\$pane[0]) void \$pane[0].offsetWidth;" . $eol
        . "        \$pane.addClass('is-pulsing');" . $eol
        . "        setTimeout(function () { \$pane.removeClass('is-pulsing'); }, 950);" . $eol
        . $eol
        . "        if (_helpSearchQuery) _highlightActiveTopic(_helpSearchQuery);" . $eol
        . "    }" . $eol;
    if (!isset($o['check'])) $s = substr($s, 0, $p1) . $new . substr($s, $p2);
    $changed++;
    echo "hunk 2 (activateHelpTopic owner re-resolution): " . (isset($o['check']) ? 'would apply' : 'applied') . "\n";
} else {
    echo "hunk 2 already present\n";
}

if (!isset($o['check']) && $changed) {
    if (file_put_contents($path, $s) === false) { fwrite(STDERR, "cannot write $path\n"); exit(2); }
}
$crAfter = substr_count($s, "\r");
echo "CR $crBefore -> $crAfter (" . ($crAfter - $crBefore) . " new lines)\n";
