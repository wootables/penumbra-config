# msheet suite fixtures - authored by REAL Excel (COM, invisible instance), so
# both parsers are tested against genuine Excel output (namespaces, r:id,
# sharedStrings, sheet state) rather than a library's idea of it.
#   make_fixtures.ps1 -Out <dir>
param([Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$before = @(Get-Process EXCEL -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.ScreenUpdating = $false
$mine = @(Get-Process EXCEL -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | ForEach-Object { $_.Id })

function New-Book([string[]]$tabs) {
    $wb = $xl.Workbooks.Add()
    while ($wb.Worksheets.Count -lt $tabs.Count) { [void]$wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) }
    while ($wb.Worksheets.Count -gt $tabs.Count) { $wb.Worksheets.Item($wb.Worksheets.Count).Delete() }
    for ($i = 0; $i -lt $tabs.Count; $i++) { $wb.Worksheets.Item($i + 1).Name = $tabs[$i] }
    return $wb
}
function Fill($ws, $rows) {
    for ($r = 0; $r -lt $rows.Count; $r++) {
        $row = $rows[$r]
        for ($c = 0; $c -lt $row.Count; $c++) {
            # PowerShell's COM binder caches the value TYPE per call site: one
            # `.Value2 = $v` line fed a string first then fails every number with
            # "Unable to cast ... to System.String". One site per type.
            $v = $row[$c]
            if ($null -eq $v -or "$v" -eq '') { continue }
            $cell = $ws.Cells.Item($r + 1, $c + 1)
            if ($v -is [int]) { $cell.Value2 = [double]$v }
            else { $cell.Value2 = [string]$v }
        }
    }
}
function Save($wb, [string]$name, [int]$fmt) {
    $p = Join-Path $Out $name
    if (Test-Path $p) { [IO.File]::Delete($p) }
    $wb.Worksheets.Item(1).Activate()
    $wb.SaveAs($p, $fmt)
    "saved $name"
}

try {
    # F1 three_tabs: Jan, Feb, Mar hold data (alphabetical order would be Feb, Jan, Mar);
    # Feb adds NOTE, Mar lacks NAME; Lookup is HIDDEN data; Notes is empty; Template has
    # headers only.
    $wb = New-Book @('Jan', 'Feb', 'Mar', 'Lookup', 'Notes', 'Template')
    Fill $wb.Worksheets.Item('Jan') @(@('ID', 'NAME', 'AMOUNT'), @(1001, 'Alpha', 120), @(1002, 'Bravo', 80), @(1003, 'Charlie', 45))
    Fill $wb.Worksheets.Item('Feb') @(@('ID', 'NAME', 'AMOUNT', 'NOTE'), @(2001, 'Delta', 300, 'late'), @(2002, 'Echo', 10, ''))
    Fill $wb.Worksheets.Item('Mar') @(@('ID', 'AMOUNT'), @(3001, 75), @(3002, 60))
    Fill $wb.Worksheets.Item('Lookup') @(@('CODE', 'LABEL'), @('A', 'Active'), @('C', 'Closed'))
    Fill $wb.Worksheets.Item('Template') @(, @('ID', 'NAME', 'AMOUNT'))
    $wb.Worksheets.Item('Lookup').Visible = 0          # xlSheetHidden
    Save $wb 'three_tabs.xlsx' 51
    Save $wb 'three_tabs.ods' 60
    $wb.Close($false)

    # F2 single: one data tab + two empty ones - must import exactly as before.
    $wb = New-Book @('Data', 'Sheet2', 'Sheet3')
    Fill $wb.Worksheets.Item('Data') @(@('ID', 'NAME', 'AMOUNT'), @(1, 'One', 10), @(2, 'Two', 20), @(3, 'Three', 30))
    Save $wb 'single.xlsx' 51
    $wb.Close($false)

    # F3 collide: tab A has its own WORKSHEET column, so ours becomes WORKSHEET_2.
    $wb = New-Book @('A', 'B')
    Fill $wb.Worksheets.Item('A') @(@('WORKSHEET', 'ID'), @('north', 1), @('south', 2))
    Fill $wb.Worksheets.Item('B') @(@('ID'), @(3))
    Save $wb 'collide.xlsx' 51
    $wb.Close($false)

    # F4 hiddenfirst: the only data is on a HIDDEN first tab; the visible tab is
    # empty. No visible sheet has data, so the old reader's answer stands: the
    # first sheet, hidden or not.
    $wb = New-Book @('Data', 'Cover')
    Fill $wb.Worksheets.Item('Data') @(@('ID', 'NAME'), @(7, 'Seven'), @(8, 'Eight'))
    $wb.Worksheets.Item('Cover').Activate()
    $wb.Worksheets.Item('Data').Visible = 0
    $p = Join-Path $Out 'hiddenfirst.xlsx'; if (Test-Path $p) { [IO.File]::Delete($p) }
    $wb.SaveAs($p, 51); 'saved hiddenfirst.xlsx'
    $wb.Close($false)

    # F5 legacy2003: XML Spreadsheet 2003 (.xls) - East, West (adds OWNER), Codes hidden.
    $wb = New-Book @('East', 'West', 'Codes')
    Fill $wb.Worksheets.Item('East') @(@('REGION_ID', 'TOTAL'), @(11, 500), @(12, 250))
    Fill $wb.Worksheets.Item('West') @(@('REGION_ID', 'TOTAL', 'OWNER'), @(21, 900, 'kim'))
    Fill $wb.Worksheets.Item('Codes') @(@('K', 'V'), @('x', 'y'))
    $wb.Worksheets.Item('Codes').Visible = 0
    Save $wb 'legacy2003.xls' 46
    $wb.Close($false)

    # F7 onetab: a workbook with exactly ONE tab - the only shape the old server
    # reader (first worksheet RELATIONSHIP, and Excel writes the rels in no
    # particular order) was right about, so the new readers must match it byte
    # for byte. Twice: .xlsx and XML Spreadsheet 2003.
    $wb = New-Book @('Only')
    Fill $wb.Worksheets.Item('Only') @(@('ID', 'NAME', 'AMOUNT', 'Mixed Case'), @(1, 'One', 10, 'a'), @(2, 'Two', '', 'b'), @(3, '', 30, ''))
    Save $wb 'onetab.xlsx' 51
    Save $wb 'onetab2003.xls' 46
    $wb.Close($false)

    # F6 case: the same columns spelled in different case on each tab.
    $wb = New-Book @('One', 'Two')
    Fill $wb.Worksheets.Item('One') @(@('Amount', 'Name'), @(5, 'x'))
    Fill $wb.Worksheets.Item('Two') @(@('AMOUNT', 'name'), @(6, 'y'))
    Save $wb 'case.xlsx' 51
    $wb.Close($false)
}
finally {
    try { $xl.Quit() } catch { }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    Start-Sleep -Milliseconds 500
    foreach ($id in $mine) { try { Stop-Process -Id $id -Force -ErrorAction Stop; "stopped our Excel $id" } catch { } }
}
