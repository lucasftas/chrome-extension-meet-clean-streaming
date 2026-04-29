# Build script - Icones PNG da extensao
# Renderiza o design E (REC + Split) em 16/48/128 px usando System.Drawing
# Salva em extension/icons/ pra ser referenciado pelo manifest.json

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "extension/icons"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

function Add-RoundedRect {
    param($Path, $X, $Y, $W, $H, $R)
    if ($R -lt 0.5) {
        $Path.AddRectangle((New-Object System.Drawing.RectangleF $X, $Y, $W, $H))
        return
    }
    $Path.AddArc($X, $Y, $R * 2, $R * 2, 180, 90)
    $Path.AddArc($X + $W - $R * 2, $Y, $R * 2, $R * 2, 270, 90)
    $Path.AddArc($X + $W - $R * 2, $Y + $H - $R * 2, $R * 2, $R * 2, 0, 90)
    $Path.AddArc($X, $Y + $H - $R * 2, $R * 2, $R * 2, 90, 90)
    $Path.CloseFigure()
}

function New-IconE {
    param([int]$Size, [string]$OutputPath)

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Scale do viewBox 128x128 pra Size
    $s = $Size / 128.0

    # Background preto com cantos arredondados (rx=20 no viewBox)
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect $bgPath 0 0 $Size $Size (20 * $s)
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(13, 13, 13))
    $g.FillPath($bgBrush, $bgPath)

    # Retangulo azul (cam): x=14, y=36, w=48, h=56, rx=4
    $bluePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect $bluePath (14 * $s) (36 * $s) (48 * $s) (56 * $s) (4 * $s)
    $blueBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(45, 127, 249))
    $g.FillPath($blueBrush, $bluePath)

    # Retangulo verde (slides): x=66, y=36, w=48, h=56, rx=4
    $greenPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect $greenPath (66 * $s) (36 * $s) (48 * $s) (56 * $s) (4 * $s)
    $greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(76, 175, 80))
    $g.FillPath($greenBrush, $greenPath)

    # Circulo vermelho (REC dot): cx=64, cy=20, r=10
    $redBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(239, 68, 68))
    $g.FillEllipse($redBrush, ((64 - 10) * $s), ((20 - 10) * $s), (20 * $s), (20 * $s))

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bitmap.Dispose()
    $bgBrush.Dispose()
    $blueBrush.Dispose()
    $greenBrush.Dispose()
    $redBrush.Dispose()
}

New-IconE -Size 16 -OutputPath (Join-Path $iconsDir "icon-16.png")
New-IconE -Size 48 -OutputPath (Join-Path $iconsDir "icon-48.png")
New-IconE -Size 128 -OutputPath (Join-Path $iconsDir "icon-128.png")

Write-Host "Icones gerados:"
Get-ChildItem -LiteralPath $iconsDir | Select-Object Name, Length | Format-Table
