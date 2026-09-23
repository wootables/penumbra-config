<?php
$__pnb_key = @file_get_contents('C:/inetpub/penumbra_config.key');
if ($__pnb_key === false || strlen($__pnb_key) !== 32) {
    error_log('CRITICAL: penumbra config key missing/unreadable (C:/inetpub/penumbra_config.key)');
    throw new Exception('Internal Server Error: Configuration missing.', 500);
}
$dec = function ($v) use ($__pnb_key) {
    if (!is_string($v) || strncmp($v, 'enc:v1:', 7) !== 0) { return $v; }
    $raw = base64_decode(substr($v, 7), true);
    $pt  = ($raw !== false && strlen($raw) > 28)
        ? openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $__pnb_key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16))
        : false;
    if ($pt === false) {
        error_log('CRITICAL: penumbra config sealed value failed to decrypt');
        throw new Exception('Internal Server Error: Configuration missing.', 500);
    }
    return $pt;
};
// ------------------------------------------------------------------------------
return [

    //db creds
    'ieprd_user' => $dec('enc:v1:LVtr8q0u3HEyCCJjSNo2BFGAFFKpve6NdvxA4qjJfn2gET90'),
    'ieprd_pass' => $dec('enc:v1:nulEVaVcb4XjL93kj/8YCrobkiaYbgxR5GqbinnLobQP1cBgmPQ='),
    'pins_user'   => $dec('enc:v1:+06z9B9Qf1udZzwUs5MmJeNtLWarsbqsmNstZ8Yttxb6qyw='),
    'pins_pass'   => $dec('enc:v1:a8Yki29COPAzEfY2ibsHm4xkwosgSjJp8AvPzHUzZRHEwBLJkWFadg=='),
    'infoed_user' => $dec('enc:v1:ftEPsDOlPMR9k3pzfGBUuA8bQrD84qmZCgWaOzcKdrN1M842LJQ='),
    'infoed_pass' => $dec('enc:v1:t8n8pGDHVCnBqpzPhNIb4RfoBYW2mgWIm+C7PJ0Go0JOIXV5qFEQfO4='),
	'hr_user'     => $dec('enc:v1:rsXwZnd5l2zza4mY6Rc4u8YdzN89JCLHCukecSYg+Q=='),
    'hr_pass'     => $dec('enc:v1:vW1w4k8qUJT4juhOYO1FEe4kMiBxfe9MDHec4KtXpIiNBEFSFomyIA3jgYPRNhDeOjE='),
	'fin_user'     => $dec('enc:v1:1DqfYAWRa4/gaHiAhD1Fi2UAk0i2JQNtGbixVjrVEr++'),
	'fin_pass'     => $dec('enc:v1:Woa1VG2bsE+0qI0jIcvj5Y6wqYXJWnB8hUPJ5//312P8+gQz9jGAW5YbIFo='),
	'dbrw_user' => $dec('enc:v1:aR3TYYXRmUWBJS4BQz/VWdCy9WXbMdIv5D1e9dd/v7D4bUrF0sMpeA=='),
	'dbrw_pass' => $dec('enc:v1:sSEI4KUAylvRc0JbjSRJSj5uqF9/HMorDMqkxNfQIO22YpXPid8LP2s9zsY='),
	
	// Centralized Allow-Lists
    'allowed_tables' => [
			'ieprd' => [
				"PENUMBRA_PEOPLE", "PENUMBRA_PEOPLE_TAGS", "PENUMBRA_PEOPLE_V", "ALC_SRAR","AWARD", "COI_5ACCT_FLAGGED", "COI_CHECK_COMPLIANCE", "COUNTRY_DATA", "DEPTCODE_COUNT_REPORT", "PDUMP_IACUC_FEED",
				"FIN_FIVE_ACCTS", "INTERNAL_AWARDS", "JOBCODE_DATA", "LOCATIONS_PT_PAM", "PAM_PI_DEPARTMENTS", 
				"PI_PERSONNEL_ON_ACTIVE", "PROJECT_PERSONNEL","REPORTER_REGISTRATIONS","REPORTER_REQUIREMENT_STATUS", 
				"SRAR_VIEW_TX", "STATS_COMBINED_V2", "STATS_RADAR_V10","STATS_DASHBOARD",
				"STATS_RED_COI_FLAG", "STATS_RED_PAM_DRIVER", "STATS_RED_PAM_PI_INFO", "STATS_RED_PAM_SPONSOR", 
				"STATS_RED_PAM_V3", "STATS_RED_PROJECT_STATUS", "STATS_RED_PT_DRIVER", "STATS_RED_PT_V3", 
				"STATS_SHADOWREALM_CLUSTERS", "STATS_SHADOWREALM_SPONSOR_FULL", "SUBAWARD", "UPO_HR_DATA", 
				"UPO_REPORT", "UNC_SYSTEM_CODE", "ABSTRACTS_DATA", "STATS_SHADOWREALM_SPONSOR_ROLLUP", 
				"STATS_SHADOWREALM_AUDIT_LOG", "STATS_RED_SUBAWARDS", "PI_ELIGIBLE_PROFILES", "STATS_RED_PT_V2", 
				"PENUMBRA_AUDIT", "RADAR_PROJECT_PROPOSAL","RES_COMPLI_RE_SECUR", "PT_DEPARTMENTS", "PT_LOCATION_INFO", "RED_ANTICIPATED", 
				"RED_ENTITY_LIST", "RED_DENORM_DYNAMIC", "RED_SPONSOR_LOOKUP", "RED_SUBAWARD_DEPARTMENTS", "DUAL",
				"PENUMBRA_SCHEDULED_TASKS", "PENUMBRA_REPORTS","STATS_RED_PAM_V2","PAM_PRIME_DEPARTMENTS","REGISTERED_USERS",
				"PENUMBRA_IMPORTS","RED_PD_COMPLETE_PERSONNEL","RED_PT_SUBMITTED_PROPOSAL_V2","STATS_COMBINED_V1","STATS_RED_PAM_SUMMARY_TERMS","PDUMP_FI_EPA"
			],
			'pins'   => [
				"MAIN_PROJECT_INFORMATION", "SPONSORS", "ROUTING", "PERSONNEL", "INVESTIGATOR_PROJECT_RELATION", 
				"NOTIFICATION_APPROVALS", "EDIT_PERMISSIONS", "HS_ROUTING", "HS_MAIN", "HS_ROUTING_STATUS", 
				"HS_PERSONNEL", "HS_RENEW", "HS_ROUTING_LEVEL", "SPONSOR_PROGRAM_INFORMATION", "DEPARTMENT_CENTER", 
				"COLLEGES", "PERSONNEL_DEPARTMENT_RELATION", "HS_EDITHIST"
			],
			'infoed' => [
				"LOVROLESSYSTEM", "LOVROLES","LOVMODULES","FACULTY", "FACULTYEXTENDED", "DEPTPERSONNEL", "F_CERT", "UNIT", "F_UNIT", "PROP_STAT", "PROPOSAL", 
				"CODETAB", "SPONSPAS", "PROJMAIN", "COIMAIN", "PROP_U", "PROJMAINPERSONNEL", "PROJMAINXREF", "F_POSITION", "PROJOBJECT", 
				"PROJOBJECTAWARD", "PROJOBJECT_U", "PT_UNIT", "PROPPDSBUDREF", "OBJECTTYPES", "TE", "TEMAIN", "TEMAININCREMENT", "TEPERIODINC", "TEPDS", 
				"RPT_DYN_PM_ATTRIBUTES","RPT_PT_PR_PERSONNEL", "DEPTINFORMATION","SP_UDF","DEPT_DUNS_UEI","CLIENTATTRIBUTES",
				"CLIENTS","CLIENTSEXTENDED","RPT_DYN_PM_SUBMISSIONS","RPT_BGT_AT", "RPT_LA_SUBMISSION","RPT_LA_INV_PI_VW","LA_PROT_U",
				"RPT_LA_SPECIESDETAIL","RPT_LA_L_ANIMALS_VW","LA_TABLE_U","NCSTATEUNI_LA_45"
			],
			'hr'     => [
                "PS_COMPENSATION","PS_DEPT_TBL","PS_JOB","PS_NC_ASGN_EMP_VW1",
				"PS_NC_ASSGN_EMP_VW","PS_NC_BUILDING","PS_NC_FACILITY_EXT","PS_NC_NIFA_BWK_VW",
				"PS_NC_NIFA_MTH_VW","PS_NC_NSF_VIEW","PS_NC_OPRDEFN_VW","PS_NC_SALRY_DISTR",
				"PS_PERSONAL_DATA",
            ],
			'fin' => [
				"PS_CLASS_CF_TBL", "PS_FUND_TBL", "PS_GL_ACCOUNT_TBL",
				"PS_NC_AUX_CODE_TBL", "PS_NC_DEPT_VW", "PS_NC_JOURNAL", "PS_NC_JRNL_COM",
				"PS_NC_LED_BALANCES", "PS_NC_LEDGER", "PS_NC_LEDGER_BUDG", "PS_NC_LEDGER_VW2",
				"PS_NC_PROJ_ATTR_VW", "PS_NC_PROJECT", "PS_NC_PROJECT_GR", "PS_NC_PROJECT_PI"
			],
    ],
	'anthropic_api_key' => $dec('enc:v1:avFON8Sw/awQ9gyPL3fvpEFrvzFY0tHDJXtYMVx9I8/qo00NMGM2C0MaB5GJhqLsWtmOS3EUbRtHXWSA7ejoCakdTIzkiIMQWgq8KLsmNZXGEA6ZVzmyeaxSFg7zwREVDKw54vSfXMHOnQpbok1z73ttiln6NBL8KXv5ioQctVPdYNWBppLZjw=='),
	'google_api_key' => $dec('enc:v1:dc7l4DKzUUo3IMXgfx/i/dSuxnzLPJGn8ux9FECJPAiV5BiEqBUrZBe6Ziu0WtjFMXli0uHRLytKF6yMQJO3BO3ezU8vP6dpDJtTHDH7Xr8e'),
    // Aggregates allowed for total rows (rows that are currency types or cast as currency or 2 decimal places will automatically total)
    'total_exemptions' => [
        //'AMOUNT_TOTAL', 'AMOUNT_INDIRECT', 'AMOUNT_DIRECT', 'PROJECT_TOTAL', 'COST_SHARE', 'PROJECT_CS_TOTAL', 
        //'PROPOSED_TOTAL', 'ANTICIPATED_', 'SPI_AMOUNT_REQUEST', 'TOTAL_SPONSOR_COSTS', 'COUNT', 'AMOUNT', 'AMT', 'CNT'
		'TOTAL','AMOUNT','COUNT','AMT','CNT','COST'
    ],
	
	// User Access Control
    // Simple list of allowed Unity IDs (First names are now pulled from Shibboleth vars)
    'allowed_users' => [
        'SCHEDULER', 
        'bplimon', 
        'trearl', 
        'mrgrady', 
        'aclark4', 
        'acortiz',
		'japorte6',
		'dswillet'
    ],

	// -----------------------------------------------------------------------
	// Granular User Grants (v1)
	// -----------------------------------------------------------------------
	// Fine-grained access for users who are NOT in 'allowed_users' (full
	// admins). Keyed by Unity ID (case-insensitive). Each user gets a LIST of
	// grants; grants are ADDITIVE (union) and FAIL-CLOSED. They can only
	// NARROW access to what 'allowed_tables' already permits - never widen it.
	//
	// Two grant shapes (mix freely per user):
	//
	//   SQL scope - what data the user may touch with ad-hoc / edited SQL:
	//     ['sql' => 'infoed']                        // an entire connection
	//     ['sql' => 'fin', 'tables' => ['PS_NC_LEDGER','PS_NC_PROJECT']]
	//                                                // specific tables only
	//     Connection keys match 'allowed_tables': ieprd, pins, infoed, hr, fin.
	//     Table names are literal (pick from the list); omit 'tables' for the
	//     WHOLE connection. A user with any sql grant may run ad-hoc queries /
	//     build new reports within that scope.
	//
	//   Report scope - which saved reports the user may WRITE (owner-level:
	//   create / overwrite / edit / delete). SHORT_ID patterns; '*' wildcards
	//   are allowed so a department can reserve an id prefix:
	//     ['reports' => 'ORIED_*']                   // any id starting ORIED_
	//     ['reports' => 'budget_summary']            // one exact id
	//     A report grant is owner-equivalent: it also lets the user VIEW/run
	//     AND edit (per-report builder console) those reports, and pulls their
	//     tables into sql scope for that run.
	//     Scheduling is NOT included by default (it emails data to arbitrary
	//     recipients). Opt a grant into it with 'scheduler' => true:
	//     ['reports' => 'ORIED_*', 'scheduler' => true]  // edit + schedule
	//
	// Notes:
	//   - Users with NO grant here keep today's behavior EXCEPT: (a) they can
	//     no longer create server reports, and (b) when running a report they
	//     are pinned to that report's own tables (not the full allow-list).
	//   - A report's saved SQL is validated at save time against the saver's
	//     sql scope, so viewers/scheduler execute it under the global rules.
	//
	// Example (leave empty to grant nobody extra access):
	//   'jdoe' => [
	//       ['sql'     => 'infoed'],
	//       ['sql'     => 'fin', 'tables' => ['PS_NC_LEDGER']],
	//       ['reports' => 'ORIED_*'],
	//   ],
	// NOTE: user_grants are now managed in penumbra_grants.php (same folder) via
	// the admin Grants tool (grants_admin.php), so this secrets file never needs
	// to be edited to change access. That file is AUTHORITATIVE when present;
	// this array is only a fallback if it is missing. Leave it empty here.
	'user_grants' => [
    ],
	// -----------------------------------------------------------------------
	// KDUSER header trust (mitigation for direct-to-origin header spoofing)
	// -----------------------------------------------------------------------
	// Identity is derived from the KDUSER request header, which is only
	// trustworthy when the request arrived through the Shibboleth (www3) proxy.
	// oitras is ALSO directly reachable, where anyone could forge KDUSER and
	// impersonate any user/admin. So only trust KDUSER when the TCP peer
	// (REMOTE_ADDR - unspoofable, unlike a header) is one of the proxy nodes
	// below; from any other source the claimed identity is ignored and the
	// request is treated as unauthenticated.
	//
	// IPs below were confirmed from IIS c-ip logs (2026-07): the SP proxy is a
	// two-node pool (10.48.12.91 / .98) carrying ~99.7% of traffic with the
	// www3.acs.ncsu.edu referer. 127.0.0.1 / ::1 = local processes on the box
	// (loopback can't be reached remotely, so it's safe to trust).
	// IMPORTANT: if the proxy pool changes, add the new node here or its users
	// get "access denied" (shows up as a spike of AUTH-GATE lines in the PHP
	// error log). The scheduler authenticates with scheduler_secret_key, NOT
	// KDUSER, so it is unaffected regardless of its (link-local) source IP.
	'trusted_proxy_ips' => [
		'10.48.12.91',   // www3 SP proxy node 1
		'10.48.12.98',   // www3 SP proxy node 2
		'127.0.0.1',     // local processes (loopback)
		'::1',           // local processes (loopback, IPv6)
	],
	// Gate behavior:
	//   'enforce' = ignore KDUSER presented from an untrusted peer (the fix).
	//   'log'     = don't block; only error_log what WOULD be ignored (dry run).
	//   'off'     = disable the gate entirely (pre-2026-07 legacy behavior).
	'kduser_gate_mode' => 'enforce',

	// CSRF guard behavior (penumbraCsrfGuard, on the state-changing endpoints):
	//   'enforce' = block requests lacking BOTH the X-Penumbra-Csrf header and a
	//               same-origin Origin/Referer; scheduler_key requests are always exempt.
	//   'log'     = don't block; only error_log what WOULD be blocked (dry run).
	//   'off'     = disable the guard entirely.
	'csrf_guard_mode' => 'enforce',

	// -----------------------------------------------------------------------
	// DROP_FILE delivery allow-lists (2026-09-04)
	// -----------------------------------------------------------------------
	// A scheduled DROP_FILE task may write ONLY under one of these roots (UNC
	// \\server\share\folder or local X:\folder, matched as a case-insensitive
	// path-segment prefix), and may connect ONLY to these hosts for sftp/scp/ftp
	// or to S3 endpoints whose host is listed (the AWS default endpoint counts as
	// s3.<region>.amazonaws.com). EMPTY = every DROP_FILE task is refused, at save
	// time and again at run time - deny by default. Checked by
	// penumbraDropDestinationError() (db_connection.php); the UNC transport then
	// re-checks the RESOLVED directory so a junction cannot redirect the write.
	// Single-quoted PHP: write each backslash twice ('\\\\server\\share').
	'file_drop_allowed_roots' => [
		// '\\\\fileserver.oit.ncsu.edu\\penumbra_drops',
		// 'D:\\penumbra_drops',
		// 2026-09-18: test destination for scheduled File Drops (created by the app
		// owner for the Custom Template E2E). Inside the webroot, so exports\web.config
		// denies ALL HTTP access to it - keep that file if this root stays listed.
		'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\exports',
	],
	'file_drop_allowed_hosts' => [
		// 'gosparcs.oit.ncsu.edu',
	],
	// Optional SSH host-key pins for sftp/scp: host => 'SHA256:<base64>' as
	// printed by `ssh-keygen -lf`, or copied from the scheduler log, which
	// records "SSH host key for HOST is SHA256:..." on every UNPINNED connection.
	// A pinned host that presents a different key is refused.
	'file_drop_sftp_fingerprints' => [
		// 'gosparcs.oit.ncsu.edu' => 'SHA256:AAAA...',
	],

	'scheduler_secret_key' => $dec('enc:v1:dwQoklPBtWcxAhFu8/VAE+f+2TS1uE7RyJkvJl21VqlafQJbBOX/vnNsGBkQ3Z+QMTju2jePy0Dj6UE2bUlGpAS2cVK1fl73nP4/Rw=='),

	// Employee directory refresh (people_sync.php, HR -> NC_REPORTING.PENUMBRA_PEOPLE).
	// The scheduler runner launches it once a day after this time (HH:MM, America/New_York).
	// Absent or '' = the runner never launches it.
	'people_sync_time' => '05:30',
	
];