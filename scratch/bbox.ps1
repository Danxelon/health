Add-Type -AssemblyName System.Drawing

$src  = "C:\Users\Farhan Iqbal\Downloads\dark.png"
$out  = "C:\Users\Farhan Iqbal\orca\health\scratch\bbox.txt"
$img  = [System.Drawing.Image]::FromFile($src)
$w = $img.Width; $h = $img.Height

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
"aspect: $([math]::Round($bboxW/$bboxH,3))" | Out-File $out -Append
"bottom-most row: $maxY  (out of $h)" | Out-File $out -Append
"bottom %: $([math]::Round(($maxY*100)/$h,1))%" | Out-File $out -Append
$img.Dispose()
