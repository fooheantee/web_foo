---
title: "NTLM Signing Changes: Why Some Third-Party Logins Break"
slug: ntlm-signing-changes-third-party-logins
description: What Microsoft's NTLM signing improvements change, why some third-party authentication products fail, and how administrators can prepare for May 2027.
category: security
pubDate: 2026-11-28T00:05:00.000Z
draft: false
fmContentType: blog
tags:
  - Active Directory
  - NTLM
  - Kerberos
  - Windows Server
  - Authentication
  - Identity Security
keywords:
  - NTLM signing
  - Active Directory
  - KB5135557
  - CVE-2026-118737
  - Windows authentication
---

> **Series:** Windows Authentication Hardening (Part 2 of 2)

In [Part 1](/blog/kerberos-aes-end-of-rc4-default/), I looked at Microsoft's move away from the RC4 default in Kerberos and how legacy service accounts can trip up authentication. This time, let's look at NTLM.

NTLM and Kerberos are separate authentication protocols, yet both remain common in enterprise environments. Kerberos is Microsoft's preferred choice for Windows domains, while NTLM hangs on to support older applications, appliances and integrations that never migrated.

Microsoft's November 2026 security update changes how Windows handles NTLM signing, a protection against attackers tampering with or relaying authentication. (A relay attack forwards someone's login to another server so the attacker can act as that person.) Ten days later, on 20 November, Microsoft documented a known issue: some third-party authentication proxies, single sign-on (SSO) tools and application packaging solutions can fail to log in.

The short version: in Phase 1, servers still accept unsigned clients, so the breakage so far comes from the known issue described below. Phase 2, in May 2027, is when unsigned clients start getting rejected.

Microsoft says the failure can occur when a device does not implement NTLM correctly. The update is working as designed, which is small comfort if the failing device is your SSO gateway. Still, knowing it is a protocol bug in the intermediary tells you where the fix has to come from: the vendor.

## NTLM is old. Why are we still using it?

NTLM is a legacy challenge-response authentication protocol that predates Kerberos in Windows. It survives because large organizations rarely replace every application, appliance and custom integration on the same schedule.

You will typically still see NTLM when:

- An older application simply lacks Kerberos support.
- A network appliance or storage device has limited domain-join capabilities.
- Traffic passes through an authentication proxy or SSO gateway that relies on NTLM.
- A client connects via an IP address instead of a hostname, preventing Kerberos from negotiating.
- A legacy integration has run untouched for years, and nobody wants to break something that still works.

Anyone who has managed enterprise infrastructure recognizes that last point. Quiet dependencies stay invisible until a baseline security update changes the rules.

## What did Microsoft change?

Microsoft's KB5135557 outlines a two-phase rollout to enforce cryptographic message signing on NTLM connections, introduced alongside fixes for CVE-2026-118737 (a CVSS 8.1 Windows RPC Runtime remote code execution vulnerability caused by improper cryptographic signature verification)

| Date             | Phase   | What changes                                                                                                                                            |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10 November 2026 | Phase 1 | Windows clients begin offering NTLM signing by default for non-anonymous connections. Servers still accept unsigned clients while logging audit events. |
| May 2027         | Phase 2 | Windows servers require NTLM signing by default and reject clients that fail to negotiate it.                                                           |

Modern Windows Server versions have supported NTLM signing for years. What changes here is the default behavior: clients now offer signing automatically, and servers will eventually refuse connections that do not use it.

A few details from Microsoft's FAQ are worth knowing. Anonymous (null session) and guest connections are exempt in both phases. In Phase 2, a rejected client sees `SEC_E_UNSUPPORTED_FUNCTION` (`0x80090302`), and the server logs a warning Event 4023 with that status. Microsoft also says these changes apply only to NTLM and do not affect Kerberos.

## NTLM signing: the detail that matters

When auditing your logs, you have to distinguish between real cryptographic message signing and an older compatibility flag that looks similar on paper.

Microsoft highlights two NTLM negotiation flags:

| Flag                            |        Value | What it means                                                                     |
| ------------------------------- | -----------: | --------------------------------------------------------------------------------- |
| `NTLMSSP_NEGOTIATE_SIGN`        | `0x00000010` | Negotiates genuine message signing backed by a cryptographic session key.         |
| `NTLMSSP_NEGOTIATE_ALWAYS_SIGN` | `0x00008000` | A legacy placeholder flag that does not provide cryptographic signing on its own. |

Per KB5135557, a compliant connection has both `NTLMSSP_NEGOTIATE_SIGN (0x00000010)` and `NTLMSSP_NEGOTIATE_KEY_EXCH (0x40000000)` set alongside Session Key Status: Present (for example, 0xE0888215 instead of 0xA0888205).

## Why are some third-party logins failing?

Microsoft's known-issue notice names authentication proxy servers, SSO products and application packaging tools that use NTLM.

During NTLM authentication, the server sends back a challenge message describing its identity. Affected products set the `NTLMSSP_NEGOTIATE_TARGET_INFO` flag in that challenge, but return an empty or incomplete `TargetInfo` list.

When NTLMv2 uses signing or encryption, Windows requires two Attribute-Value (AV) pairs inside `TargetInfo`:

- `MsvAvNbComputerName` (`0x0001`): the server's NetBIOS computer name.
- `MsvAvNbDomainName` (`0x0002`): the server's NetBIOS domain name.

If either field is missing, Windows rejects the login with `STATUS_LOGON_FAILURE`. Microsoft points to the NTLM protocol specification, which lists both pairs as required, so this is a strict check catching an incomplete implementation.

> **When old hardware becomes the blocker:** Enterprise appliances and older storage boxes are built to last, and I have a soft spot for hardware that just keeps running. The catch is that out-of-support firmware will never get a patch for a protocol bug like this. Microsoft's notice specifically names proxies, SSO products and packaging tools rather than NAS boxes, so don't jump yet. Go check your own devices instead of assuming.

## How can administrators identify affected systems?

Start with Windows event logs, then drop down to packet captures if an application fails unexpectedly.

### 1. Review NTLM Operational events

Open the `Microsoft-Windows-NTLM/Operational` log on your clients and servers:

| Event ID | Where it is recorded | What to look for                                                                                                                    |
| -------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 4022     | Client-side          | Negotiated NTLM flags and whether the client offered signing.                                                                       |
| 4023     | Server-side          | Negotiated NTLM flags and whether the incoming connection used signing.                                                             |
| 4021     | Client-side          | Logged when a machine authenticates to a remote resource through NTLM. `Target Machine: Not Found` can point to an affected device. |

Microsoft notes that Events 4022 and 4023 require Windows Server 2019 or later with NTLM Enhanced auditing (Microsoft's expanded NTLM logging, which KB5135557 links to a setup guide) enabled. Microsoft also points to Event 4021 when you want to know whether it is safe to remove the registry override described below.

Do not filter these logs by severity level alone, because both signed and unsigned sessions can appear as Warning events. Open the event details and confirm:

- `0x00000010` (`NTLMSSP_NEGOTIATE_SIGN`) is present
- `0x40000000` (`NTLMSSP_NEGOTIATE_KEY_EXCH`) is present
- `Session Key Status: Present`

Any connection missing the `SIGN` bit or an active session key needs attention before Phase 2 arrives in May 2027. KB5135557 also includes a PowerShell script that lists clients not sending `SIGN`, which is worth running before you build your own.

### 2. Capture a network trace when TargetInfo is missing

If a third-party login breaks and Event 4021 points to missing target metadata, capture a packet trace (using Wireshark or `pktmon`) and inspect the `NTLMSSP_CHALLENGE` packet.

Check three details:

- Is the `NTLMSSP_NEGOTIATE_TARGET_INFO` flag set?
- Is the `TargetInfo` payload empty or truncated?
- Are both `MsvAvNbComputerName` and `MsvAvNbDomainName` included?

Confirming this in a packet trace separates a vendor bug from an ordinary password or account lockout issue.

## What should administrators do before May 2027?

Resist the urge to disable NTLM signing across your entire fleet just to silence a single broken app. Track down the specific dependencies and fix them properly.

### 1. Establish a baseline

- Deploy the November 2026 Windows updates.
- Enable NTLM Enhanced auditing on supported systems.
- Collect Events 4022 and 4023 to map every client or service connecting without signing.
- Document the application, vendor, host, service account and business owner for each finding.

### 2. Contact the product vendor

Ask affected vendors whether their software supports the KB5135557 signing requirements and whether a patch is available. If the product sends an incomplete `TargetInfo` block, only a vendor update can fix the underlying handshake.

### 3. Migrate to Kerberos where possible

Switching an application from NTLM to Kerberos is often the cleanest long-term fix, provided the environment supports it. Before making the switch, verify that:

- Both the application and its authentication library support Kerberos.
- The service has a valid SPN registered on the exact account running the service.
- Clients connect using DNS names rather than raw IP addresses.
- Any intermediate proxies or load balancers support Kerberos delegation or pass-through.

Test the migration with the application owner first, otherwise you risk trading an NTLM failure for a Kerberos SPN mismatch.

### 4. Treat registry overrides as temporary exceptions

Microsoft provides a client-side registry value, `ClientAllowUnsignedNtlm`, under:

`HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Lsa\MSV1_0`

By default, it is `0` (clients offer signing on non-anonymous connections). Setting it to `1` stops the client from offering `NTLMSSP_NEGOTIATE_SIGN`. Treat this strictly as a short-term workaround: scope it to specific machines, document an expiry date and remove it once the vendor releases a fix. Microsoft also says it might remove these keys at a future date, so do not build a long-term plan on them.

On the server side, `ServerRequireNtlmSign` lets you enforce signing early on validated servers so you can catch stragglers on your own schedule before May 2027. Microsoft says no restart is required.

## Kerberos is a way forward, but not a magic switch

It is tempting to treat Kerberos as an instant cure for every NTLM headache. Microsoft's FAQ says these signing changes do not touch Kerberos, so moving an app over takes it out of scope for them. It also puts the app back in scope for everything in [Part 1](/blog/kerberos-aes-end-of-rc4-default/): SPN ownership, `msDS-SupportedEncryptionTypes` and AES key rotation.

## Preparing before May 2027

Microsoft's NTLM signing rollout shows how quickly a baseline Windows update can expose protocol shortcuts hidden inside third-party products for years... May 2027 sounds far away, but vendor patches and Kerberos migrations take months to coordinate.

Use the new audit events to find unsigned traffic, check packet captures when `TargetInfo` errors appear, push vendors for patches and migrate eligible apps to Kerberos. May 2027 sounds far away, but legacy authentication dependencies take time to untangle. Finding them during an audit beats discovering them during an outage.

---

## Further reading

- [Microsoft KB5135557: NTLM signing security improvements in Windows](https://support.microsoft.com/en-us/servicing/os/windows/docs/2026/11/kb5135557-ntlm-signing-security-improvements)
- [The Register: Microsoft's NTLM security changes trip up third-party logins (25 November 2026)](https://www.theregister.com/security/2026/11/25/microsofts-ntlm-security-changes-trip-up-third-party-logins/5312085)
- [Microsoft Learn: NT LAN Manager (NTLM) authentication protocol](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/)
