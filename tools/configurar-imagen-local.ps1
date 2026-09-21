param(
  [switch]$InstalarModelo,
  [ValidateSet('auto','flux','sdxl','cpu')][string]$Perfil = 'auto',
  [string]$ComfyUI = '',
  [string]$Modelo = ''
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ConfigPath = Join-Path $Root '.rollapp-image-config.json'

function NvidiaInfo {
  $cmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  $line = (& $cmd --query-gpu=name,memory.total --format=csv,noheader,nounits | Select-Object -First 1)
  if (-not $line) { return $null }
  $parts = $line -split ','
  [pscustomobject]@{ Name=$parts[0].Trim(); VramMB=[int]$parts[1].Trim(); Vendor='NVIDIA' }
}
function GpuInfo {
  $nvidia = NvidiaInfo
  if ($nvidia) { return $nvidia }
  $gpu = Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1
  if (-not $gpu) { return [pscustomobject]@{Name='Sin GPU detectada';VramMB=0;Vendor='CPU'} }
  # AdapterRAM es DWORD en algunos drivers: sirve solo como señal conservadora.
  $mb = if ($gpu.AdapterRAM) { [math]::Floor([uint64]$gpu.AdapterRAM / 1MB) } else { 0 }
  $vendor = if ($gpu.Name -match 'NVIDIA') {'NVIDIA'} elseif ($gpu.Name -match 'AMD|Radeon') {'AMD'} elseif ($gpu.Name -match 'Intel') {'Intel'} else {'Otro'}
  [pscustomobject]@{ Name=$gpu.Name; VramMB=$mb; Vendor=$vendor }
}
$gpu = GpuInfo
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
$auto = if ($gpu.Vendor -eq 'NVIDIA' -and $gpu.VramMB -ge 12288) {'flux'} elseif ($gpu.VramMB -ge 8192) {'sdxl'} else {'cpu'}
if ($Perfil -eq 'auto') { $Perfil = $auto }

$profiles = @{
  flux = @{
    label='FLUX.1-schnell FP8'; file='flux1-schnell-fp8.safetensors';
    url='https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell-fp8.safetensors?download=true';
    width=768; height=1024; steps=4; cfg=1.0; sampler='euler'; scheduler='simple'; architecture='flux'
  }
  sdxl = @{
    label='SDXL 1.0 optimizado'; file='sd_xl_base_1.0.safetensors';
    url='https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors?download=true';
    width=768; height=1024; steps=28; cfg=6.5; sampler='dpmpp_2m'; scheduler='karras'; architecture='sdxl'
  }
  cpu = @{
    label='Stable Diffusion 1.5 CPU'; file='v1-5-pruned-emaonly.safetensors';
    url='https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors?download=true';
    width=512; height=704; steps=12; cfg=6.0; sampler='lcm'; scheduler='normal'; architecture='sd15'
  }
}
$p = $profiles[$Perfil]
if ($Modelo) { $p.file = $Modelo }
if (-not $ComfyUI) {
  $candidates = @(
    (Join-Path $Root 'ComfyUI_windows_portable\ComfyUI'),
    (Join-Path $env:USERPROFILE 'ComfyUI\ComfyUI'),
    (Join-Path $env:USERPROFILE 'ComfyUI')
  )
  $ComfyUI = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
$modelDir = if ($ComfyUI) { Join-Path $ComfyUI 'models\checkpoints' } else { '' }
$modelPath = if ($modelDir) { Join-Path $modelDir $p.file } else { '' }

$config = [ordered]@{
  detectedAt=(Get-Date).ToString('o'); profile=$Perfil; autoProfile=$auto
  gpu=[ordered]@{name=$gpu.Name; vendor=$gpu.Vendor; vramMB=$gpu.VramMB}
  ramGB=$ramGB; comfyUrl='http://127.0.0.1:8188'; comfyPath=$ComfyUI
  model=$p.file; modelPath=$modelPath; architecture=$p.architecture
  width=$p.width; height=$p.height; steps=$p.steps; cfg=$p.cfg
  sampler=$p.sampler; scheduler=$p.scheduler
}
$config | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $ConfigPath
Write-Host "GPU: $($gpu.Name) | VRAM detectada: $([math]::Round($gpu.VramMB/1024,1)) GB | RAM: $ramGB GB"
Write-Host "Perfil ARCANVEIL: $Perfil - $($p.label)"
Write-Host "Configuración: $ConfigPath"

if ($InstalarModelo) {
  if (-not $modelDir) { throw 'No encuentro ComfyUI. Instálalo o pasa -ComfyUI C:\ruta\ComfyUI.' }
  New-Item -ItemType Directory -Force $modelDir | Out-Null
  if (Test-Path $modelPath) { Write-Host "El modelo ya existe: $modelPath" }
  else {
    Write-Host "Descargando $($p.label). Puede tardar; no cierres esta ventana."
    Start-BitsTransfer -Source $p.url -Destination $modelPath -DisplayName "Modelo ARCANVEIL $Perfil"
    Write-Host "Modelo instalado: $modelPath"
  }
}
