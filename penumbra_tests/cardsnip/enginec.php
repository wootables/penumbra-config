<?php
// cardsnip - engine C (scheduled email) half. Includes ONLY the functions extract_engine_c.php lifted from
// schedule_runner.php (never its main loop: Oracle + it sends email). data(cards) is 'true' exactly when the
// email's body is the saved cards: saved showing cards (penumbra_cards_email) and not a pivot.
//   php enginec.php <fns.php>   prints RESULTS_JSON:[...]
error_reporting(E_ALL & ~E_DEPRECATED);
require $argv[1];
$R = array();
function rec($name, $pass, $detail) { global $R; $R[] = array('name' => $name, 'pass' => (bool)$pass, 'detail' => (string)$detail); }
function d($key, $view) { return strip_tags((string)_snippet_dispatch('data', array($key), array(), array(), $view, array(), array())); }

$GLOBALS['penumbra_cards_email'] = array('title' => 'NAME', 'big' => '', 'fields' => array(), 'size' => 'large');
$a = d('cards', 'standard'); $b = d('cardsize', 'standard'); $g = d('cards', 'grouped');
rec('X1 saved as Large cards: data(cards)=true, data(cardsize)=large (flat and grouped)', $a === 'true' && $b === 'large' && $g === 'true', "cards=$a size=$b grouped=$g");

$GLOBALS['penumbra_cards_email'] = null;
$a = d('cards', 'standard'); $b = d('cardsize', 'standard');
rec('X2 saved as a table: data(cards)=false, data(cardsize)=medium', $a === 'false' && $b === 'medium', "cards=$a size=$b");

$GLOBALS['penumbra_cards_email'] = array('title' => 'NAME', 'big' => '', 'fields' => array(), 'size' => 'compact');
$a = d('cards', 'pivot'); $b = d('cardsize', 'standard');
rec('X3 a pivot email is never cards: data(cards)=false over a pivot; Small = small', $a === 'false' && $b === 'small', "pivot cards=$a size=$b");

// a prompt answer named "cards" does not shadow the key (reserved, as in the browser)
$a = strip_tags((string)_snippet_dispatch('data', array('cards'), array(), array(), 'standard', array('cards' => 'PROMPTVAL'), array()));
rec('X4 a prompt named cards does not shadow data(cards)', $a === 'true', "cards=$a");
$GLOBALS['penumbra_cards_email'] = null;

echo 'RESULTS_JSON:' . json_encode($R) . "\n";
