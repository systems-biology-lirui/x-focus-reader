Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot '..\store-assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
$image = [System.Drawing.Bitmap]::new(440, 280)
$graphics = [System.Drawing.Graphics]::FromImage($image)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bounds = [System.Drawing.Rectangle]::new(0, 0, 440, 280)
$gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new($bounds, [System.Drawing.Color]::FromArgb(8, 29, 50), [System.Drawing.Color]::FromArgb(15, 87, 128), 0)
$graphics.FillRectangle($gradient, $bounds)
$glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(28, 102, 221, 242))
$graphics.FillEllipse($glow, 295, -110, 260, 260)
$graphics.FillEllipse($glow, -90, 170, 240, 240)

$icon = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot '..\icons\icon128.png'))
$graphics.DrawImage($icon, 27, 50, 114, 114)
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$pale = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 223, 240))
$teal = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(113, 237, 221))
$titleFont = [System.Drawing.Font]::new('Microsoft YaHei', 27, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = [System.Drawing.Font]::new('Microsoft YaHei', 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$smallFont = [System.Drawing.Font]::new('Microsoft YaHei', 12, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('X 专注阅读', $titleFont, $white, 160, 66)
$graphics.DrawString('收集想看的推文', $subtitleFont, $pale, 162, 114)
$graphics.DrawString('原生详情与评论', $subtitleFont, $pale, 162, 138)
$linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(75, 185, 219, 237), 1)
$graphics.DrawLine($linePen, 30, 207, 410, 207)
$graphics.DrawString('Ctrl 拖动收集', $smallFont, $teal, 31, 226)
$graphics.DrawString('Ctrl + Shift + X 开始阅读', $smallFont, $white, 177, 226)
$image.Save((Join-Path $assets 'small-promo-440x280.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$linePen.Dispose()
$titleFont.Dispose()
$subtitleFont.Dispose()
$smallFont.Dispose()
$white.Dispose()
$pale.Dispose()
$teal.Dispose()
$icon.Dispose()
$glow.Dispose()
$gradient.Dispose()
$graphics.Dispose()
$image.Dispose()
