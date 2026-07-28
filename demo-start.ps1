# MedUni — DEMO uchun mahalliy ishga tushirish (Render'ga bogʻliq emas).
#
#   Oʻng tugma → "Run with PowerShell"   yoki   .\demo-start.ps1
#
# Baza — oʻsha Supabase (Frankfurt), yaʼni maʼlumot jonli sayt bilan BIR XIL.
# Internet faqat bazaga ulanish uchun kerak; sayt oʻzi shu kompyuterda ishlaydi.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Test-Port($port) {
  $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

Write-Host ""
Write-Host "  MedUni — mahalliy demo" -ForegroundColor Cyan
Write-Host "  ----------------------" -ForegroundColor Cyan

# --- API (port 8000) ---
if (Test-Port 8000) {
  Write-Host "  API      : allaqachon ishlayapti (8000)" -ForegroundColor Yellow
} else {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\api'; npm run dev"
  Write-Host "  API      : ishga tushirildi (8000)" -ForegroundColor Green
}

# --- WEB (port 3000) ---
if (Test-Port 3000) {
  Write-Host "  Web      : allaqachon ishlayapti (3000)" -ForegroundColor Yellow
} else {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\web'; npm run dev"
  Write-Host "  Web      : ishga tushirildi (3000)" -ForegroundColor Green
}

# API tayyor boʻlishini kutamiz (birinchi ishga tushish ~15-25 s)
Write-Host ""
Write-Host "  Tayyor boʻlishi kutilmoqda..." -NoNewline
$ok = $false
foreach ($i in 1..40) {
  Start-Sleep -Seconds 2
  try {
    Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 3 -UseBasicParsing | Out-Null
    $ok = $true
    break
  } catch { Write-Host "." -NoNewline }
}
Write-Host ""

if ($ok) {
  Write-Host ""
  Write-Host "  ✔ Tayyor:  http://localhost:3000" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Loginlar:" -ForegroundColor Cyan
  Write-Host "    admin       admin@meduni.uz             / admin123"
  Write-Host "    oʻqituvchi  teacher.m11demo@meduni.uz   / student123"
  Write-Host "    talaba      student@meduni.uz           / student123"
  Write-Host ""
  Start-Process "http://localhost:3000"
} else {
  Write-Host "  ✖ API javob bermadi. Ochilgan PowerShell oynasidagi xatoni koʻring." -ForegroundColor Red
}
