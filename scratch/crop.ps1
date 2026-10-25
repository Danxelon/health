Add-Type -AssemblyName System.Drawing

$srcDark  = "C:\Users\Farhan Iqbal\Downloads\dark.png"
$srcLight = "C:\Users\Farhan Iqbal\Downloads\light.png"
$outDir    = "C:\Users\Farhan Iqbal\orca\health\public"

function Crop-Png($src, $dst, $cropH) {
    $img = [System.Drawing.Image]::FromFile($src)
    try {
        $w = $img.Width
        $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $cropH
        $bmp  = $img.Clone($rect, $img.PixelFormat)
        $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "$src -> $dst  ($w`x$cropH)"
    } finally {
        $img.Dispose()
    }
}

# Wordmark bbox: y=0..3634 (height 3634 / 6250 = 58.1%).
# Crop to 60% (y=3750) — keeps the wordmark fully, trims most of the subtitle.
$hCrop = [int](6250 * 0.60)
Crop-Png $srcDark  "$outDir\logo-dark.png"  $hCrop
Crop-Png $srcLight "$outDir\logo-light.png" $hCrop
Write-Host "Done."
