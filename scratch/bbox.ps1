Add-Type -AssemblyName System.Drawing

$src  = "C:\Users\Farhan Iqbal\Downloads\dark.png"
$out  = "C:\Users\Farhan Iqbal\orca\health\scratch\bbox.txt"
$img  = [System.Drawing.Image]::FromFile($src)
$w = $img.Width; $h = $img.Height

# Scan rows 0-800 and all columns to find the bounding box of the wordmark
$minX=$w; $maxX=0; $minY=0; $maxY=0
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $img.GetPixel($x, $y)
        if ($c.A -gt 20) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
$bboxW = $maxX - $minX + 1
$bboxH = $maxY - $minY + 1
"$src" | Out-File $out -Append
"$w`x$h" | Out-File $out -Append
"bbox: $minX,$minY,$maxX,$maxY  size=$bboxW`x$bboxH" | Out-File $out -Append
"aspect: $([math]::Round($bboxW/$bboxH, 3))" | Out-File $out -Append
"top% (above wordmark): $([math]::Round(($minY*100)/$h,1))%" | Out-File $out -Append
"bottom% (below wordmark): $([math]::Round((($h-$maxY)*100)/$h,1))%" | Out-File $out -Append

# Also capture the last N rows with content
$bottomRows = 0
for ($y = $h-1; $y -ge 0; $y--) {
    $found = $false
    for ($x = 0; $x -lt $w; $x++) {
        if ($img.GetPixel($x, $y).A -gt 20) { $found = $true; break }
    }
    if ($found) { $bottomRows = $h - $y; break }
}
"$bottomRows visible rows from bottom" | Out-File $out -Append
$img.Dispose()