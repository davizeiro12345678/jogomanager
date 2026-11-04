#requires -Version 5.1
<#
JogoManager: bounded external client probe. Safe by default.
- Does not log in, enumerate private services or change anything on VPS.
- Tests only TCP/22 and two existing public health/catalog URLs.
- NOT a VPS CPU/RAM/NVMe or bandwidth benchmark.
#>
[CmdletBinding()]
param(
    [ValidateRange(3,30)][int]$TcpSamples = 16,
    [ValidateRange(3,15)][int]$HttpSamples = 8,
    [string]$OutputDirectory = "$env:USERPROFILE\Downloads"
)
$ErrorActionPreference='Stop'
$culture=[Globalization.CultureInfo]::InvariantCulture
$st=[DateTime]::UtcNow
function Percentile([double[]]$Numbers,[double]$Percent) {
    if($Numbers.Count -lt 1){return $null}
    $ordered=@($Numbers | Sort-Object)
    $index=[Math]::Max(0,[Math]::Ceiling($ordered.Count*$Percent)-1)
    return [Math]::Round($ordered[$index],2)
}
function Measure-Tcp([string]$ip,[int]$count) {
    $samples=New-Object 'System.Collections.Generic.List[double]'
    $errors=0
    for($i=0;$i -lt $count;$i++){
        $s=[Diagnostics.Stopwatch]::StartNew()
        $c=New-Object Net.Sockets.TcpClient
        try {
            $task=$c.ConnectAsync($ip,22)
            $ok=$task.Wait(3000)
            $s.Stop()
            if($ok -and $c.Connected){$samples.Add([Math]::Round($s.Elapsed.TotalMilliseconds,2))}
            else{$errors++}
        } catch {$errors++} finally {$c.Dispose()}
        Start-Sleep -Milliseconds 120
    }
    return [pscustomobject]@{Ip=$ip;Port=22;Count=$count;Succeeded=$samples.Count;Failed=$errors;P50Ms=(Percentile $samples.ToArray() 0.50);P95Ms=(Percentile $samples.ToArray() 0.95);MinMs=($samples|Measure-Object -Minimum).Minimum;MaxMs=($samples|Measure-Object -Maximum).Maximum;RawMs=@($samples)}
}
function Measure-Http([string]$url,[int]$count) {
    $values=New-Object 'System.Collections.Generic.List[double]'
    $codes=New-Object 'System.Collections.Generic.List[string]'
    $errs=0
    for($i=0;$i -lt $count;$i++){
        $result = & curl.exe --silent --connect-timeout 5 --max-time 10 --output NUL --write-out '%{http_code};%{time_connect};%{time_appconnect};%{time_starttransfer};%{time_total}' $url 2>$null
        if($LASTEXITCODE -eq 0 -and $result -match '^\d{3};'){
            $v=$result -split ';'; $codes.Add($v[0])
            $ttfb=[double]::Parse($v[3],$culture)*1000
            $values.Add([Math]::Round($ttfb,2))
        }else{$errs++}
        Start-Sleep -Milliseconds 180
    }
    return [pscustomobject]@{Url=($url -split '\?')[0];Count=$count;Succeeded=$values.Count;Failed=$errs;Codes=@($codes);TtfbP50Ms=(Percentile $values.ToArray() 0.50);TtfbP95Ms=(Percentile $values.ToArray() 0.95);RawTtfbMs=@($values)}
}
$t=@(
    (Measure-Tcp '194.163.188.190' $TcpSamples),
    (Measure-Tcp '144.91.111.116' $TcpSamples)
)
$h=@(
    (Measure-Http 'https://jogomanager.com/api/health' $HttpSamples),
    (Measure-Http 'https://catalog.jogomanager.com/v1/public/clubs?limit=1&page=0' $HttpSamples)
)
$doc=[pscustomobject]@{
    kind='external-client-timing'
    measured_utc=$st.ToString('o')
    origin='WCOM-457 Windows PowerShell 5.1'
    disclaimer='TCP connect and public HTTPS TTFB measured from the desktop; NOT CPU, memory, NVMe, iperf3 or VPS local latency.'
    tcp=$t
    https=$h
}
if(-not (Test-Path -LiteralPath $OutputDirectory)){New-Item -ItemType Directory -Path $OutputDirectory -Force|Out-Null}
$file=Join-Path $OutputDirectory ("jogomanager-vps-client-probe-"+$st.ToString('yyyyMMdd-HHmmss')+".json")
$doc|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $file -Encoding UTF8
Write-Output '=== TCP connect (from Windows) ==='
$t|Select-Object Ip,Succeeded,Failed,P50Ms,P95Ms,MinMs,MaxMs|Format-Table -AutoSize|Out-String|Write-Output
Write-Output '=== HTTPS TTFB (from Windows) ==='
$h|Select-Object Url,Succeeded,Failed,TtfbP50Ms,TtfbP95Ms|Format-Table -AutoSize|Out-String|Write-Output
Write-Output "RESULT_JSON=$file"
