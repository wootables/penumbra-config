<?php
/**
 * visual_harness.php - render ONE help topic the way its two hosts show it, as static HTML
 * for a headless-Edge screenshot (2026-10-15, phase 2).
 *
 *   php -n visual_harness.php --app=<stage> --topic=<id> --out=<dir> [--scroll=0,600] [--theme=<body class>]
 *
 * Writes <out>/hub_<scroll>.html   : the Help Center shell (.help-center-shell > sidebar + #helpCenterContent)
 *                                    with the topic active, scrolled by <scroll> px on load
 *        <out>/panel_<scroll>.html : the dashboard's own help panel (#dashHelpOverlay .dash-help-body), the
 *                                    way penumbra_dashboard.js openHelpPanel() builds it: close button and
 *                                    first h3 removed, the single-key toggle label on the Dashboards topic
 * Expects main.css and penumbra_dashboard.css already copied into <out> (the harness never reads the webroot).
 * A probe badge at the bottom-left prints scrollWidth / clientWidth of the scrolling pane, so a horizontal
 * overflow shows as two different numbers even when the scrollbar is hidden.
 */
$o = getopt('', array('app:', 'topic:', 'out:', 'scroll::', 'theme::'));
foreach (array('app', 'topic', 'out') as $k) { if (empty($o[$k])) { fwrite(STDERR, "usage: --app=<stage> --topic=<id> --out=<dir> [--scroll=0,600] [--theme=<class>]\n"); exit(2); } }
$frag = rtrim($o['app'], '\\/') . '/help/topics/' . $o['topic'] . '.php';
if (!is_file($frag)) { fwrite(STDERR, "no fragment: $frag\n"); exit(2); }
$scrolls = array_map('intval', explode(',', isset($o['scroll']) ? $o['scroll'] : '0,600'));
$theme = isset($o['theme']) ? $o['theme'] : '';

define('PNB_HELP_V2', true);
if (!function_exists('pnb_help_show')) { function pnb_help_show($aud) { return true; } }
$isAdmin = true;
ob_start();
include $frag;
$html = ob_get_clean();

// Hub: the topic div as the loader emits it, marked active.
$hub = preg_replace('~class="help-topic"~', 'class="help-topic is-active"', $html, 1);

// Panel: the inner HTML of .lightbox-content, minus the close button and the first h3 (openHelpPanel.render()).
$inner = preg_replace('~^.*?<div class="lightbox-content"[^>]*>~s', '', $html);
$inner = preg_replace('~</div>\s*</div>\s*$~s', '', $inner);
$inner = preg_replace('~<button type="button" class="close-lightbox"[^>]*>.*?</button>~s', '', $inner, 1);
$inner = preg_replace('~<h3\b[^>]*>.*?</h3>~s', '', $inner, 1);
$toggle = ($o['topic'] === 'dashboardsHelpLightbox')
    ? '<label class="dash-keys-toggle"><input type="checkbox" id="dashKeysToggle" checked> Single-key shortcuts (R, H, K, E, A, S, P here; on a report press ? for its keys; r and 1 to 4 on Health)</label>'
    : '';

$probe = '<div id="probe" style="position: fixed; left: 4px; bottom: 4px; z-index: 99; font: 12px monospace; background: #ff0; color: #000; padding: 2px 6px;"></div>';
function pnb_vh_script($paneSel, $scroll) {
    return '<script>window.addEventListener("load", function () { var p = document.querySelector(' . json_encode($paneSel) . '); if (!p) { return; } p.scrollTop = ' . (int) $scroll . '; ' .
        'var pr = p.getBoundingClientRect(), wide = []; Array.prototype.forEach.call(p.querySelectorAll("*"), function (el) { var r = el.getBoundingClientRect(); if (r.width && r.right > pr.right + 1 && !el.querySelector("*:not(code):not(em):not(strong):not(kbd)")) { wide.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "[" + Math.round(r.right - pr.right) + "px] " + (el.textContent || "").trim().substring(0, 50)); } }); ' .
        'document.getElementById("probe").textContent = "pane scrollWidth " + p.scrollWidth + " / clientWidth " + p.clientWidth + " / scrollTop " + p.scrollTop + " / innerWidth " + window.innerWidth + (wide.length ? " | WIDE: " + wide.slice(0, 4).join(" || ") : ""); });</script>';
}
$head = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="main.css"><link rel="stylesheet" href="penumbra_dashboard.css">' .
    '<style>html, body { margin: 0; height: 100%; } body { background: #d8dde3; font-family: Segoe UI, Verdana, sans-serif; } </style></head>';

foreach ($scrolls as $s) {
    $hubDoc = $head . '<body class="' . htmlspecialchars($theme) . '">' .
        '<div class="help-center-shell" style="margin: 20px auto;">' .
        '<div class="help-center-sidebar"><div class="help-center-searchwrap"><div class="help-search-field"><input id="helpCenterSearch" placeholder="Search help"></div></div>' .
        '<div class="help-center-toc"><div class="help-toc-group"><div class="help-toc-group-label">Find and filter</div><button type="button" class="help-toc-item is-active">' . htmlspecialchars($o['topic']) . '</button><button type="button" class="help-toc-item">Another topic</button></div></div></div>' .
        '<div class="help-center-main" id="helpCenterContent"><button type="button" class="close-lightbox" aria-label="Close">&times;</button>' . $hub . '</div>' .
        '</div>' . $probe . pnb_vh_script('#helpCenterContent', $s) . '</body></html>';
    file_put_contents(rtrim($o['out'], '\\/') . "/hub_$s.html", $hubDoc);

    $panelDoc = $head . '<body class="' . htmlspecialchars($theme) . '">' .
        '<div class="dash-overlay" id="dashHelpOverlay" data-topic="' . htmlspecialchars($o['topic']) . '"><div class="dash-panel dash-panel-wide" role="dialog" aria-modal="true" tabindex="-1">' .
        '<div class="dash-panel-head"><h2>' . htmlspecialchars($o['topic']) . '</h2><a class="dash-help-full" href="#">Full Help Center &#8599;</a>' .
        '<button type="button" class="dash-help-close penumbra-fs-dialog-close" title="Close (Esc)" aria-label="Close">&times;</button></div>' .
        '<div class="dash-panel-body dash-help-body">' . $toggle . $inner . '</div>' .
        '</div></div>' . $probe . pnb_vh_script('#dashHelpOverlay .dash-help-body', $s) . '</body></html>';
    file_put_contents(rtrim($o['out'], '\\/') . "/panel_$s.html", $panelDoc);
}
echo "wrote hub_/panel_ for scrolls " . implode(',', $scrolls) . " into " . $o['out'] . "\n";
