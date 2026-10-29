<?php
// cards suite: the registry's theme CSS and ids (run with the webroot as $argv[1]); the emitter PRINTS, so it is captured
require $argv[1] . '/themes_config.php';
ob_start(); $r = penumbra_emit_theme_css(); $css = ob_get_clean();
if (is_string($r) && $r !== '') $css .= $r;
$out = array('css' => $css, 'themes' => array());
foreach (penumbra_get_themes() as $id => $t) {
    $out['themes'][] = array('id' => $t['id'], 'label' => $t['label'], 'isDark' => !empty($t['isDark']), 'modern' => !empty($t['cssVars']), 'legacy' => !empty($t['legacy']));
}
echo json_encode($out);
