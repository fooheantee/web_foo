---
title: One OT Machine, One Certificate, Several Complications
description: An old Windows machine, a vendor who said 'die die must use IIS Manager', and a wildcard certificate I politely refused to hand over.
pubDate: 2026-10-31T04:28:31.785Z
slug: one-machine-one-cert
draft: false
tags:
  - cybersecurity
  - operational-technology
  - windows
  - certificates
  - https
keywords:
  - cybersecurity
  - operational-technology
  - windows
  - certificates
  - https
date: 2026-10-31T05:17:49.945Z
---

Enabling HTTPS should be routine. Generate a Certificate Signing Request (CSR), get a Certificate Authority (CA) to issue the certificate, install it, bind it, test it. Done before lunch.

At least, that is how it looks on paper.

Recently, I had to enable HTTPS on an older Windows machine in an operational technology (OT) environment. Then the constraints started stacking up:

1. The machine ran an older Windows version and was not allowed to join the domain.
2. It sat on an isolated OT network segment, but still had to talk to the enterprise network.
3. We could not install third-party software on it.
4. The vendor was adamant: "die die" must use IIS Manager to generate the CSR. No discussion.

That last one became the problem.

*(Names, hostnames and environment details in this post are changed or generalised.)*

## The shortlist kept getting shorter

There are several ways to create a CSR on Windows. These were my options:

| Method | Tool | Interface | Result for This Machine |
| :--- | :--- | :--- | :--- |
| **1** | MMC Certificates snap-in | Windows GUI | Not accepted for this workflow |
| **2** | DigiCert Certificate Utility | Third-party GUI | Blocked: no third-party software |
| **3** | IIS Manager | Windows Server GUI | Vendor's choice, but the wizard had a SAN limitation |
| **4** | OpenSSL | Cross-platform CLI | Blocked: no third-party software |
| **5** | `certreq` with a custom INF file | Native Windows CLI | Selected |

I normally prefer to generate the private key on the target machine and keep it there. No exporting, no copying keys around, unless there is a clear reason.

## The missing SAN field

Here is why Method 3 did not work. Modern clients check the hostname against the Subject Alternative Name (SAN) extension in the certificate, not the old Common Name (RFC 9525 covers this). The *Create Certificate Request* wizard in IIS manager had no field for SAN entries.

To be fair, this is a limit of the wizard and version this particular OT machine had, not a claim that every IIS workflow lacks SAN support.

I explained this to the vendor. The reply came quickly:

"Why not just provide an internal wildcard certificate?"

## A wildcard? Not so fast

It is the classic easy button. One `*.example.com` certificate to rule them all.

But a wildcard certificate comes with a private key. Handing that package to a third party, to sit on an isolated OT machine, is a big blast-radius risk. If that legacy machine is ever compromised, the attacker does not just own one node. They can impersonate every hostname the wildcard covers. It is like giving a contractor the master key to the whole building so he can open one electrical room.

I politely declined and stuck to my rule: **one node, one certificate, one unique private key.**

The trade-off, in short:

| | Shared wildcard | Individual certificate |
| :--- | :--- | :--- |
| **Blast radius** | Every name the wildcard covers | Only that node's names |
| **Key handling** | Same key copied to many hosts | Key generated and kept on the node |
| **Renewal and revocation** | Affects every system using it | Handled per node |

## Back to basics: Windows already had the tool

That left Method 5. The built-in `certreq` utility, plus a small `request.inf` file. No new software. SAN entries in the request. And the private key created locally, where it belongs.

Here is the INF file, with example values:

```ini
[Version]
Signature="$Windows NT$"

[NewRequest]
Subject = "CN=OT Console, O=Example Company, OU=OT, C=XX"
KeyLength = 2048
HashAlgorithm = SHA256
KeySpec = 1
KeyUsage = 0xA0
MachineKeySet = TRUE
ProviderName = "Microsoft RSA SChannel Cryptographic Provider"
ProviderType = 12
RequestType = PKCS10
Exportable = FALSE

[Extensions]
2.5.29.17 = "{text}"
_continue_ = "DNS=ot-console.example.com&"
_continue_ = "DNS=ot-service.example.com"

[EnhancedKeyUsageExtension]
OID = 1.3.6.1.5.5.7.3.1
```

The settings that matter most:

- `MachineKeySet = TRUE` creates the key in the local computer context.
- `Exportable = FALSE` blocks normal export of the private key. It does not stop a determined attacker on a compromised machine, but it removes the easy path.
- The `2.5.29.17` block is the SAN extension. Separate names with `&`, use fully qualified DNS names only, and no `https://`.

Then four commands, run in an elevated prompt:

```powershell
certreq -new -machine request.inf cert.req
certutil -dump cert.req
certreq -accept -machine issued.cer
certutil -store my
```

In order: create the CSR, check what you are about to send, accept the issued certificate on the same machine, and confirm it is in the local store. The `.req` file holds the request, never the private key. There is no reason to send a private-key package just to get a signed certificate.

A few honest caveats:

> **Check before you copy.** This INF is a starting point, not a universal template. The text-form SAN syntax is not supported on every old Windows version, so check your version and run `certreq -v -?` first. Your CA's template may also ignore or rewrite requested SAN values, so always inspect the issued certificate.

## The ending

Helped the vendor with the CSR generation, got the certificate issued, installed it with `certreq -accept`, and configured the HTTPS binding. HTTPS worked, with the vendor's application on the same old machine, no third-party software and no shared wildcard key.


One small reminder: a successful install does not prove the application is using the right certificate. Test with the hostname that is in the SAN.

## What I would do differently next time

Before we talk about anyone's favourite tool, I would settle four questions:

1. Which hostnames must the certificate cover?
2. Where must the private key be generated and stored?
3. Does the application really need an exportable key?
4. Which request methods and certificate profiles does the vendor actually support?

They sound simple. Agreeing on them early can save a lot of back and forth.

In the end, generating the CSR was the easy part. Agreeing on the requirements and the security trade-offs took longer.

And sometimes the best solution is not another tool to install. It is learning to use the tools you already have.

## References

- [Microsoft: `certreq` command](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certreq)
- [Microsoft: `certutil` command](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil)
- [Microsoft: Add a subject alternative name to a secure LDAP certificate](https://learn.microsoft.com/en-us/troubleshoot/windows-server/certificates-and-public-key-infrastructure-pki/add-san-to-secure-ldap-certificate)
- [RFC 9525: Service Identity in TLS](https://www.rfc-editor.org/rfc/rfc9525)
