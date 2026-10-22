<?php
// render_themes.php - the Settings panel's theme options as index.php renders them (the registry's list)
//   php -n render_themes.php <themes_config.php>
require $argv[1];
echo penumbra_render_theme_options('', true);
