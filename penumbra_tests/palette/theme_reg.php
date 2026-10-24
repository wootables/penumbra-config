<?php
// theme_reg.php (jarbusy, 2026-10-23) - the theme registry as the page has it, for the contrast checks: every theme's id and
// isDark, and the generated variable blocks index.php emits after the stylesheets (penumbra_emit_theme_css: the twelve themes
// whose variables live in the registry; the original six define theirs in css/main.css).
//   php -n theme_reg.php <themes_config.php>
require $argv[1];
ob_start();
penumbra_emit_theme_css();
$css = preg_replace('~^\s*<style[^>]*>|</style>\s*$~', '', ob_get_clean());
$themes = array();
foreach (penumbra_get_themes() as $id => $t) {
    if (!empty($t['legacy'])) { continue; }   // (a legacy theme is not offered: the Settings list skips it too)
    $themes[] = array('id' => $id, 'label' => $t['label'], 'isDark' => !empty($t['isDark']));
}
echo json_encode(array('css' => $css, 'themes' => $themes));
