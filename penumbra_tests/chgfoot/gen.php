<?php
// View Options layout suite: emits the live theme registry next to vo.html.
//   themes.js      window.PNB_THEMES = [{id,label,isDark,modern}]  (active themes, display order)
//   themevars.css  exactly what penumbra_emit_theme_css() puts in <head>, minus the <style> tags
// usage: php -n gen.php <outdir> <app dir>
$out = $argv[1];
require $argv[2] . '/themes_config.php';

$all = penumbra_get_themes();
$rows = array();
foreach (penumbra_get_active_theme_ids() as $id) {
    $t = $all[$id];
    $rows[] = array('id' => $id, 'label' => $t['label'], 'isDark' => !empty($t['isDark']), 'modern' => !empty($t['cssVars']));
}
file_put_contents($out . '/themes.js', 'window.PNB_THEMES = ' . json_encode($rows) . ";\n");

ob_start();
penumbra_emit_theme_css();
$css = preg_replace('#</?style[^>]*>#', '', ob_get_clean());
file_put_contents($out . '/themevars.css', $css);
echo count($rows) . " themes\n";
