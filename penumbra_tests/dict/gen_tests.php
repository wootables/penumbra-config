<?php
// dict suite - php half (2026-10-22): generate_dictionary.php's helpers, lifted with
// PNB_DICT_LIB_ONLY (the file returns before db_connection.php or any request handling).
//   php -n gen_tests.php        (PNB_DICT_GEN = the file under test; run.py sets it)
define('PNB_DICT_LIB_ONLY', true);
$file = getenv('PNB_DICT_GEN') ?: '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\generate_dictionary.php';
require $file;
$pass = 0; $fail = 0;
function t($name, $ok, $info = '') { global $pass, $fail; if ($ok) { $pass++; } else { $fail++; echo "FAIL $name " . (is_string($info) ? $info : json_encode($info)) . "\n"; } }

// --- the tables a query reads
$q = "SELECT a.x, b.y FROM ieprd.STATS_COMBINED_V2 a JOIN \"Other_T\" b ON a.id = b.id\n"
   . "LEFT OUTER JOIN people p ON 1=1 -- FROM COMMENTED\n/* JOIN hidden_t */ WHERE a.z IN (SELECT q FROM sub_t) AND s = 'FROM quoted_t'";
t('tablesBasic', pnb_dict_tables_in_sql($q) === array('STATS_COMBINED_V2', 'OTHER_T', 'PEOPLE', 'SUB_T'), pnb_dict_tables_in_sql($q));
t('tablesComma', pnb_dict_tables_in_sql('select * from t1 x, s.t2, t3 y where 1=1') === array('T1', 'T2', 'T3'), pnb_dict_tables_in_sql('select * from t1 x, s.t2, t3 y where 1=1'));
t('tablesDblink', pnb_dict_tables_in_sql('select * from T4@remote_db') === array('T4'));
t('tablesMssql', pnb_dict_tables_in_sql('select * from [dbo].[Awards] a inner join InfoEd.dbo.Props p on 1=1') === array('AWARDS', 'PROPS'), pnb_dict_tables_in_sql('select * from [dbo].[Awards] a inner join InfoEd.dbo.Props p on 1=1'));
t('tablesNoDual', pnb_dict_tables_in_sql('select sysdate from dual') === array());
t('tablesCap', count(pnb_dict_tables_in_sql('select * from a1 join a2 on 1=1 join a3 on 1=1 join a4 on 1=1', 2)) === 2);

// --- DDL sections
$ddl = "-- Table: ALPHA\nCREATE TABLE ALPHA (\n    A NUMBER\n);\n\n-- Table: STATS_COMBINED_V2\nCREATE TABLE STATS_COMBINED_V2 (\n    RECORD_ID VARCHAR2(20)\n);\n-- Table: GAMMA\nCREATE TABLE GAMMA (G DATE);\n";
$s = pnb_dict_ddl_sections($ddl, array('STATS_COMBINED_V2'));
t('ddlPicks', strpos($s, 'RECORD_ID') !== false && strpos($s, 'ALPHA') === false && strpos($s, 'GAMMA') === false, $s);
t('ddlCap', pnb_dict_ddl_sections($ddl, array('ALPHA', 'GAMMA'), 60) !== '' && strpos(pnb_dict_ddl_sections($ddl, array('ALPHA', 'GAMMA'), 60), 'GAMMA') === false);
t('ddlNone', pnb_dict_ddl_sections($ddl, array()) === '');

// --- the payload parser (js/penumbra_dict.js parse() twin)
$p = pnb_dict_parse("Note line\n# c\nA | ? draft | source: T.A\nB | ! avoid\nC | x | y\n | nameless");
t('parseCount', count($p) === 3, $p);
t('parseFlags', $p[0]['draft'] && !$p[0]['avoid'] && $p[0]['source'] === 'T.A' && $p[1]['avoid'] && $p[1]['text'] === 'avoid', $p);
t('parsePipe', $p[2]['text'] === 'x | y' && $p[2]['source'] === '', $p[2]);
t('blocks', pnb_dict_blocks("a dict|`X | 1` b dict |  `Y | 2`") === array('X | 1', 'Y | 2'));

// --- known facts from other reports
$mk = function ($snip, $enc = false) { return json_encode($enc ? array('encrypted' => true, 'content' => 'PENUMBRA_GCM::xx') : array('query' => 'select 1', 'reportSnippet' => $snip)); };
$reports = array(
    array('self', $mk("action(infobox, D, dict|`A | mine | source: STATS_COMBINED_V2.A`)")),
    array('r1', $mk("action(infobox, D, dict|`X | checked meaning | source: STATS_COMBINED_V2.X\nY | ? draft meaning | source: STATS_COMBINED_V2.Y\nZ | other table | source: OTHER.Z\nW | no source\nV | ! do not use v | source: stats_combined_v2.V`)")),
    array('r2', $mk("action(infobox, D, dict|`X2 | duplicate source | source: STATS_COMBINED_V2.X\nE | expr | source: A + B`)")),
    array('r3', $mk('', true)),
    array('r4', 'not json'),
);
$f = pnb_dict_known_facts($reports, array('STATS_COMBINED_V2'), 'SELF');
t('factsChecked', in_array('STATS_COMBINED_V2.X | checked meaning', $f['lines'], true), $f);
t('factsNoDraft', !preg_grep('/draft meaning/', $f['lines']), $f);
t('factsNoOtherTable', !preg_grep('/other table/', $f['lines']));
t('factsNoSelf', !preg_grep('/mine/', $f['lines']));
t('factsAvoid', in_array('STATS_COMBINED_V2.V | ! do not use v', $f['lines'], true), $f);
t('factsDedupe', !preg_grep('/duplicate source/', $f['lines']) && !preg_grep('/expr/', $f['lines']), $f);
t('factsCount', count($f['lines']) === 2 && $f['reports'] === 1, $f);
t('factsNoReportIds', !preg_grep('/\br1\b|\br2\b/', $f['lines']));
t('factsNoTables', pnb_dict_known_facts($reports, array(), 'self')['lines'] === array());

// --- the prompt and the answer
$up = pnb_dict_user_prompt(array('columns' => array(array('name' => 'amt', 'formula' => ''), array('name' => 'TRIPLE', 'formula' => '{X} * 3')), 'sql' => 'SELECT 1',
    'existing' => 'amt | checked', 'facts' => array('T.X | f'), 'seeds' => 'seed text', 'comments' => array('T.X: c'), 'ddl' => 'CREATE TABLE T'));
t('promptSections', strpos($up, "- amt\n") !== false && strpos($up, '[calculated in the page: {X} * 3]') !== false && strpos($up, 'SELECT 1') !== false
   && strpos($up, 'amt | checked') !== false && strpos($up, 'T.X | f') !== false && strpos($up, 'seed text') !== false && strpos($up, 'T.X: c') !== false && strpos($up, 'CREATE TABLE T') !== false, $up);
$up2 = pnb_dict_user_prompt(array('columns' => array(array('name' => 'a')), 'sql' => 's', 'existing' => '', 'facts' => array(), 'seeds' => '', 'comments' => array(), 'ddl' => ''));
t('promptOmitsEmpty', strpos($up2, 'KNOWN FACTS') === false && strpos($up2, 'CURRENT DICTIONARY') === false && strpos($up2, 'TABLE DEFINITIONS') === false, $up2);
$sp = pnb_dict_system_prompt();
t('systemNoData', strpos($sp, 'NAME | MEANING | source: SOURCE') !== false && strpos($sp, 'Never invent') !== false);
$ans = pnb_dict_clean_answer("```text\nOne row per X.\n\n- A | uses `ticks` | source: T.A\n* B | b\n```\n");
t('cleanAnswer', $ans === "One row per X.\nA | uses 'ticks' | source: T.A\nB | b", $ans);

// --- (2026-10-22 b) the pivot
$pp = pnb_dict_parse("[pivot]\nAmt | ? adds | source: sum(H_AMT)\n[columns]\nV_ID | id | source: T.V_ID");
t('parseSkipsPivot', count($pp) === 1 && $pp[0]['name'] === 'V_ID', $pp);
$pvp = pnb_dict_user_prompt(array('columns' => array(array('name' => 'a')), 'sql' => 's', 'existing' => '', 'facts' => array(), 'seeds' => '', 'comments' => array(), 'ddl' => '',
    'pivot' => array('rows' => array('Fiscal Year', 'Dept'), 'columns' => array('Status'), 'values' => array(array('label' => 'Awards $', 'agg' => 'sum', 'column' => 'AMT', 'filter' => "TYPE = 'AWARD'"),
        array('label' => '% Change', 'agg' => 'pct_change', 'column' => 'AMT')), 'rowTotals' => array('sum'), 'topN' => array('n' => 10))));
t('promptPivot', strpos($pvp, 'THE PIVOT THE REPORT SHOWS') !== false && strpos($pvp, 'Fiscal Year > Dept') !== false && strpos($pvp, "Awards $: aggregation sum of column AMT; only rows where TYPE = 'AWARD'") !== false
   && strpos($pvp, '% Change: aggregation pct_change') !== false && strpos($pvp, 'Row totals: ["sum"]') !== false && strpos($pvp, 'top/bottom') !== false && strpos($pvp, 'pct_change = percent change') !== false, $pvp);
t('promptNoPivot', strpos($up2, 'THE PIVOT') === false);
t('systemPivot', strpos($sp, 'a line reading exactly [pivot]') !== false && strpos($sp, 'Grand Total') !== false && strpos($sp, '[columns]') !== false);
$facts2 = pnb_dict_known_facts(array(array('r9', $mk("action(infobox, D, dict|`[pivot]\nSTATS_COMBINED_V2.Z | pivot line | source: STATS_COMBINED_V2.Z\n[columns]\nQ | col | source: STATS_COMBINED_V2.Q`)"))), array('STATS_COMBINED_V2'), 'self');
t('factsNoPivotLines', count($facts2['lines']) === 1 && $facts2['lines'][0] === 'STATS_COMBINED_V2.Q | col', $facts2);
echo "SUMMARY pass=$pass fail=$fail\n";
