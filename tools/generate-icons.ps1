Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$iconDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
$base = [System.Drawing.Bitmap]::new(128, 128, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($base)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$blue = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(24, 139, 211))
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$softBlue = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(180, 224, 247))
$teal = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(16, 185, 174))

$tile = New-RoundedPath 16 16 96 96 22
$graphics.FillPath($blue, $tile)
$card = New-RoundedPath 42 30 55 70 10
$graphics.FillPath($white, $card)
foreach ($line in @(@(52, 45, 34), @(52, 58, 29), @(52, 71, 35), @(52, 84, 23))) {
  $graphics.FillRectangle($softBlue, $line[0], $line[1], $line[2], 5)
}
$graphics.FillEllipse($teal, 17, 72, 39, 39)
$plusPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 5)
$plusPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$plusPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($plusPen, 36.5, 83, 36.5, 100)
$graphics.DrawLine($plusPen, 28, 91.5, 45, 91.5)
$base.Save((Join-Path $iconDir 'icon128.png'), [System.Drawing.Imaging.ImageFormat]::Png)

foreach ($size in @(48, 32, 16)) {
  $scaled = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
  $scaledGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scaledGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $scaledGraphics.Clear([System.Drawing.Color]::Transparent)
  $scaledGraphics.DrawImage($base, 0, 0, $size, $size)
  $scaled.Save((Join-Path $iconDir "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $scaledGraphics.Dispose()
  $scaled.Dispose()
}

$plusPen.Dispose()
$tile.Dispose()
$card.Dispose()
$blue.Dispose()
$white.Dispose()
$softBlue.Dispose()
$teal.Dispose()
$graphics.Dispose()
$base.Dispose()
