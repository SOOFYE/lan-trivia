"use strict";
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const virtual =
  /vpn|wsl|vethernet|hyper-v|vmware|vbox|virtualbox|docker|radmin|tailscale|zerotier|wireguard|tunnel|\btun\d*\b|\btap\d*\b/i;
const privateIP = (ip) =>
  /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

// Read-only Windows adapter and Internet Connection Sharing metadata. No admin
// prompt, network requests, firewall changes, or hotspot configuration changes.
const windowsScript = `
$ErrorActionPreference = 'Stop'
$shared = @{}
try {
  $sharing = New-Object -ComObject HNetCfg.HNetShare
  foreach ($connection in $sharing.EnumEveryConnection) {
    try {
      $config = $sharing.INetSharingConfigurationForINetConnection($connection)
      if ($config.SharingEnabled -and $config.SharingConnectionType -eq 1) {
        $properties = $sharing.NetConnectionProps($connection)
        $shared[$properties.Guid.ToString().Trim('{}').ToLowerInvariant()] = $true
      }
    } catch {}
  }
} catch {}
$adapters = @(Get-NetAdapter -IncludeHidden)
$rows = @(foreach ($address in Get-NetIPAddress -AddressFamily IPv4) {
  $adapter = $adapters | Where-Object { $_.InterfaceIndex -eq $address.InterfaceIndex } | Select-Object -First 1
  if ($adapter -and $adapter.Status -eq 'Up' -and $address.AddressState -eq 'Preferred') {
    $guid = $adapter.InterfaceGuid.ToString().Trim('{}').ToLowerInvariant()
    [pscustomobject]@{ name = $address.InterfaceAlias; ip = $address.IPAddress; description = $adapter.InterfaceDescription; shared = [bool]$shared[$guid] }
  }
})
ConvertTo-Json -InputObject @($rows) -Compress
`;
async function windowsAdapters() {
  const executable = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const { stdout } = await run(
    executable,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", windowsScript],
    {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      encoding: "utf8",
    },
  );
  const rows = JSON.parse(stdout.replace(/^\uFEFF/, "").trim() || "[]");
  return Array.isArray(rows) ? rows : [rows];
}
function selectAddresses(interfaces, metadata = []) {
  const addresses = Object.entries(interfaces).flatMap(([name, list]) =>
    (list || [])
      .filter(
        (a) =>
          (a.family === "IPv4" || a.family === 4) &&
          !a.internal &&
          !a.address.startsWith("169.254.") &&
          a.address !== "0.0.0.0",
      )
      .map((a) => {
        const info = metadata.find((row) => row.ip === a.address) || {};
        const identity = `${name} ${info.description || ""}`;
        const isVirtual = virtual.test(identity);
        const hotspot =
          !isVirtual &&
          (info.shared === true ||
            /wi-fi direct|wifi direct|mobile hotspot|hotspot|local area connection\*/i.test(
              identity,
            ));
        let score = privateIP(a.address) ? 40 : 20;
        if (isVirtual || /virtual/i.test(identity)) score -= 100;
        if (hotspot) score = info.shared === true ? 160 : 140;
        // Standard ICS address is only a fallback hint, not a hard-coded join URL.
        if (!isVirtual && a.address === "192.168.137.1") score += 40;
        return { name, ip: a.address, hotspot, score };
      }),
  );
  return addresses.sort(
    (a, b) =>
      b.score - a.score ||
      a.name.localeCompare(b.name) ||
      a.ip.localeCompare(b.ip),
  );
}
function createNetworkDetector(options = {}) {
  const platform = options.platform || process.platform;
  const interfaces = options.interfaces || (() => os.networkInterfaces());
  const probe = options.probe || windowsAdapters;
  let signature = "",
    metadata = [],
    lastProbe = 0;
  return async function detect() {
    const current = interfaces();
    const nextSignature = JSON.stringify(
      Object.entries(current)
        .map(([name, list]) => [
          name,
          (list || []).map((a) => a.address).sort(),
        ])
        .sort(),
    );
    if (
      platform === "win32" &&
      (nextSignature !== signature || Date.now() - lastProbe > 15000)
    ) {
      try {
        metadata = await probe();
      } catch {
        metadata = [];
      }
      signature = nextSignature;
      lastProbe = Date.now();
    }
    const addresses = selectAddresses(interfaces(), metadata);
    // VPN/VM-only connectivity is not advertised as a network phones can join.
    const best = addresses.find((a) => a.score > 0);
    return {
      addresses,
      ip: best?.ip || "127.0.0.1",
      hotspot: best?.hotspot || false,
    };
  };
}
module.exports = { createNetworkDetector, selectAddresses, windowsAdapters };
