---
title: "Memory-Safe Languages Still Run on C: 2026 CVE Lessons"
slug: memory-safe-languages-still-run-on-c
description: How late-2026 CVEs in Java, PHP, Ruby, OpenSSL, and NGINX show why memory-safe languages still inherit C/C++ buffer overflows, and how SBOMs and VEX help.
category: security
pubDate: 2026-11-21T06:41:07.865Z
draft: false
fmContentType: blog
tags:
  - Application Security
  - Vulnerability Management
  - Buffer Overflow
  - SBOM
  - Memory Safety
keywords:
  - buffer overflow
  - memory-safe languages
  - CVE-2026-114938
  - Java4Shell
  - CVE-2026-132825
  - Ruby2Shell
  - SBOM
  - VEX
  - vulnerability management
---

In my past life as a software test engineer and low-level programmer (not what you might think,I mean C programming and Real-Time Operating Systems, or RTOS), buffer overflows were one of my most dreaded bugs. Troubleshooting them meant hooking up a JTAG hardware debugger and manually crawling through raw memory addresses just to see where data had spilled over the line.

If you write modern web applications in Java, PHP, or Ruby, you probably assume those low-level memory headaches are ancient history. Then November 2026 happened. Within days, a wave of critical vulnerabilities hit OpenSSL, Java, Ruby, PHP, and NGINX, reminding us that memory-safe languages still rest on a foundation of C and C++.

## What Is a Buffer Overflow?

A buffer is simply a fixed-size block of memory reserved to hold temporary data, like an incoming network packet or user input. A **buffer overflow** happens when a program writes more data into that space than it was built to hold, overwriting whatever sits next to it in memory.

Think of it like pouring two liters of water into a one-liter bottle; except the excess water doesn't just make a mess on the table, it rewrites the labels on the bottles next to it. Attackers exploit that spillover to corrupt data, crash services, or hijack execution flow to run their own code.

In modern environments, these flaws usually show up in three ways:

- **Stack-based buffer overflows:** Overwriting temporary function data (the call stack) to redirect what code the CPU executes next.
- **Heap-based buffer overflows:** Corrupting dynamically allocated memory (the heap) where application objects live, which attackers can manipulate to gain arbitrary read or write access.
- **Integer overflows and underflows:** A math bug where a number wraps around its maximum or minimum limit. This is often how the other two get triggered: a program calculates a tiny buffer size by mistake, allocates too little memory, and then copies a massive amount of data right past the end of it.

## Why "Memory-Safe" Languages Still Got Hit

If Java, PHP, and Ruby are designed to prevent memory corruption, why were they all caught up in November 2026's vulnerability wave? It comes down to what sits underneath.

### 1. The Core Cause: Memory-Unsafe Languages (C and C++)

Buffer overflows occur overwhelmingly in low-level languages like C and C++ because developers must manually allocate and free memory. If a developer forgets to check the size of incoming data before copying it into memory, an overflow occurs.

### 2. High-Level Runtimes vs. Low-Level Libraries

- **OpenSSL and NGINX (Directly Vulnerable):** Both are written primarily in C and sit directly in the path of raw network traffic. A single bounds-checking mistake in how they parse packets or encode data translates directly into memory corruption.
- **PHP, Ruby, and Java (Memory-Safe Runtimes):** These high-level languages automatically manage memory and enforce bounds checking. Writing standard application code in them will not cause a classic buffer overflow, exceeding a limit simply throws an error or exception.

### 3. The Hidden Link: Underlying C Engines and Extensions

Even though PHP, Ruby, and Java are memory-safe on the surface, they rely heavily on C and C++ underneath:

- **The Interpreters and VMs:** The standard PHP interpreter (Zend Engine), the standard Ruby interpreter (MRI/YARV), and the Java Virtual Machine (HotSpot JVM) are all written in C or C++. A memory bug inside the engine itself bypasses the language's safety nets entirely.
- **Native Extensions and Bundled Libraries:** High-level runtimes offload heavy lifting: such as compression, image processing, and TLS encryption to native C/C++ libraries. If an application relies on a vulnerable C library underneath, it inherits that memory-corruption risk.

## Inside the October and November 2026 Vulnerabilities

Here is how those hidden C and C++ dependencies played out across five major technologies this October and November.

### 1. Java: CVE-2026-114938 ("Java4Shell")

- **CVSS Score:** 9.2 Critical (CVSS v4.0) / 8.1 High (CVSS v3.1)
- **Vulnerability Type:** Heap-based Buffer Overflow (CWE-122)
- **How it happens:** Even though Java is memory-safe, this flaw lives inside the HotSpot JVM's own optimized C++ code, not in Java code. On x86-64 CPUs with AVX-512 VBMI support, the hardware-optimized Base64 decoder (`java.util.Base64.Decoder`) miscalculates the output length for malformed input and writes 62 to 63 bytes past the end of its buffer. Java does reject the bad input, but only after the write occurs. Crafted input can crash the JVM and, in researchers' demonstrations, lead to remote code execution (RCE, meaning an attacker runs their own code on your server). ARM machines, including Apple silicon and AWS Graviton, are not affected.

### 2. OpenSSL: CVE-2026-121481

- **CVSS Score:** Low (OpenSSL's own rating). An early automated 9.8 Critical score circulated, but NVD now carries 5.9 Medium from CISA's enrichment.
- **Vulnerability Type:** Heap-based Buffer Overflow via Integer Overflow (CWE-190)
- **How it happens:** Because OpenSSL is written in C, this flaw sits directly in its `EVP_EncodeBlock()` Base64 encoding function. When fed an enormous input (over roughly 1.5 GB, so the encoded output no longer fits in a 32-bit signed integer), the C math calculating the output buffer size overflows and wraps around, causing OpenSSL to write past the allocated heap buffer. _(OpenSSL's own record rates this Low: its TLS, QUIC, and CMS code never encode buffers that large, and no attacker-triggerable path is known. An application would have to pass in a length near `INT_MAX` itself, which means already holding a buffer of around two gigabytes. The CVE record lists OpenSSL `4.0.0`–`4.0.3` and `4.1.0` as affected, with `4.0.4` and `4.1.1` as the first unaffected releases.)_

### 3. Ruby: CVE-2026-132825 ("Ruby2Shell")

- **CVSS Score:** Critical (GitHub Security Advisory) / 7.4 High (CVSS v3.1)
- **Vulnerability Type:** Heap-based Buffer Overflow
- **How it happens:** This bug lives in the C-based Ruby interpreter's string case-conversion logic. When converting text in legacy single-byte encodings (such as ISO-8859-1 or Windows-1252), the German sharp s (`ß`) expands from one byte into two (`SS`). A missing bounds check on that second byte causes a one-byte heap buffer overflow, enough to corrupt adjacent heap memory. Researchers say it can lead to remote code execution, including on default Rails apps. The same release fixed seven Ruby issues in total.

### 4. PHP and Brotli: CVE-2026-111497 & CVE-2026-129481

- **CVSS Score:** CVE-2026-129481: 9.2 Critical (CVSS v4.0, high attack complexity) / CVE-2026-111497: 9.2 Critical (CVSS v4.0, Google) / 8.1 High (CVSS v3.1, Red Hat)
- **Vulnerability Type:** Out-of-Bounds Write (Buffer Overflow) & Use-After-Free
- **How it happens:** PHP's fixes this Oct and Nov highlight both sides of the C-dependency problem:
  - **Bundled C library overflow (CVE-2026-111497, October):** PHP rebuilt its official Windows packages to fix an out-of-bounds write in Google's Brotli compression library, a C library bundled into those builds. In those builds, the vulnerable decoder can be reached through the cURL extension when automatic HTTP response decompression is enabled. That setting is off by default in cURL, but applications and HTTP client libraries can switch it on.
  - **C session memory corruption (CVE-2026-129481, November):** PHP's 19 November release fixed a critical use-after-free flaw (where code keeps using memory after it has been released) in session handling. When a session shutdown is interrupted, a stale pointer survives into a later request on the same worker, which can crash the worker or corrupt memory. PHP says code execution hasn't been demonstrated, and the bug requires specific conditions. It is described as an incomplete fix for an October bug (`CVE-2026-109619`).

### 5. NGINX: CVE-2026-123007

This was one of five NGINX flaws that CERT-EU says allow unauthenticated code execution, fixed in the 18 November releases alongside several lower-severity bugs. It affects versions `1.9.5` through `1.31.8`.

- **CVSS Score:** 9.2 Critical (CVSS v4.0)
- **Vulnerability Type:** Heap-based Buffer Overflow via Integer Underflow (CWE-191)
- **How it happens:** Written in C for raw speed, NGINX suffered a flow-control accounting bug in its HTTP/2 module (`ngx_http_v2_module`). Returning flow-control credit for unsent data causes an integer underflow, bypassing a bounds check and triggering an invalid memory copy on the heap. On servers with HTTP/2 enabled, that can crash a worker process and potentially allow unauthenticated RCE. A public proof-of-concept exists. Fixes are in `1.30.7` and `1.31.9`, and disabling HTTP/2 is a stopgap.

## October and November 2026 Vulnerability Summary

| CVE ID              | Affected Tech  | Peak CVSS                      | Flaw Type                                | Root Layer                                      |
| :------------------ | :------------- | :----------------------------- | :--------------------------------------- | :---------------------------------------------- |
| **CVE-2026-114938** | Java (OpenJDK) | 9.2 (v4.0) / 8.1 (v3.1)        | Heap Buffer Overflow                     | C++ HotSpot JVM (AVX-512 Base64 decoder)        |
| **CVE-2026-121481** | OpenSSL        | 5.9 (NVD) / Low (vendor)       | Heap Buffer Overflow (Integer Overflow)  | Core C Library (`EVP_EncodeBlock`)              |
| **CVE-2026-132825** | Ruby           | Critical (vendor) / 7.4 (v3.1) | Heap Buffer Overflow (1-byte)            | C MRI/YARV Interpreter (String case conversion) |
| **CVE-2026-111497** | PHP            | 9.2 (v4.0) / 8.1 (v3.1)        | Out-of-Bounds Write                      | Bundled C Library (Google Brotli)               |
| **CVE-2026-129481** | PHP            | 9.2 (v4.0)                     | Use-After-Free                           | C Session Extension                             |
| **CVE-2026-123007** | NGINX          | 9.2 (v4.0)                     | Heap Buffer Overflow (Integer Underflow) | Core C Module (`ngx_http_v2_module`)            |

## What This Means for Defenders

Memory-safe languages protect you from writing buffer overflows in your own business logic, not from the C and C++ engines running underneath them. In my humble opinion, AI-assisted tools may be shrinking the window between a hidden C bug existing and someone finding it.

Back in my software testing days, we spent long hours doing graybox testing, combining knowledge of the system's internals with structured test cases and exploratory "monkey testing," where you throw unexpected inputs at a program just to see what breaks. As a human, I could only poke at a system for eight hours a day. Today, AI-powered fuzzing and autonomous agents are running that exact same graybox testing at machine speed, around the clock, and at massive scale. Uncovering the kind of subtle edge case, say a one-byte overflow in a legacy encoding, that humans easily miss.

When vulnerabilities surface at that pace, you cannot afford to spend days figuring out what is buried inside your tech stack. That is why agencies like NIST and CISA emphasize maintaining a **Software Bill of Materials (SBOM)**: essentially a complete ingredient list of every runtime, framework, and bundled C library inside your applications. When a zero-day hits, whether it is Log4j or a vulnerable Brotli compression library inside PHP's Windows builds, an up-to-date SBOM lets your vulnerability management team find where the affected component lives in hours instead of days.

However, an SBOM alone won't tell you whether you're actually exploitable. OpenSSL's Low-rated overflow is a good example, since the library is everywhere but almost nothing can reach the bug. That gap is what **VEX (Vulnerability Exploitability eXchange)** documents are for: the SBOM says what's inside, and a VEX statement says whether a given flaw actually affects it.

Keep writing your applications in memory-safe languages, because they still eliminate entire classes of bugs from your own code. Just don't mistake a safe language for a self-contained bubble: keep your SBOMs current, automate base-image and runtime patching, and treat underlying engine updates with the same urgency as a flaw in your own business logic.

## References

_Status checked: 21 November 2026_

- **Java4Shell (`CVE-2026-114938`):** [OpenJDK Vulnerability Advisory (17 Nov 2026)](https://openjdk.org/groups/vulnerability/advisories/2026-11-17) · [Check Point Technical Analysis](https://blog.checkpoint.com/security/java4shell-cve-2026-114938-check-your-java-services-now/)
- **OpenSSL (`CVE-2026-121481`):** [OpenSSL PR #33652](https://github.com/openssl/openssl/pull/33652) · [NVD Record](https://nvd.nist.gov/vuln/detail/cve-2026-121481) · [OpenCVE Record](https://app.opencve.io/cve/CVE-2026-121481) · [Ubuntu Security Tracker](https://ubuntu.com/security/CVE-2026-121481)
- **Ruby2Shell (`CVE-2026-132825`):** [Ruby Security Advisory (18 Nov 2026)](https://www.ruby-lang.org/en/news/2026/11/18/multiple-vulnerabilities-in-regexp-and-string/) · [GitHub Advisory GHSA-34m4-m9fh-gqp5](https://github.com/ruby/ruby/security/advisories/GHSA-34m4-m9fh-gqp5) · [Veria Labs Write-Up](https://verialabs.com/ruby2shell/)
- **PHP & Brotli (`CVE-2026-111497`, `CVE-2026-129481`):** [PHP Windows Builds Notice (26 Oct 2026)](https://www.php.net/archive/2026.php#2026-10-26-1) · [Google Brotli 1.2.1 Release](https://github.com/google/brotli/releases/tag/v1.2.1) · [PHP Session Advisory GHSA-g3vh-838c-65v7](https://github.com/php/php-src/security/advisories/GHSA-g3vh-838c-65v7)
- **NGINX (`CVE-2026-123007`):** [NGINX Security Advisories](https://nginx.org/en/security_advisories.html) · [Wiz Analysis of NGINX HTTP/2 RCE Vulnerabilities](https://www.wiz.io/blog/nginx-http2-rce-vulnerabilities)
- **SBOM & VEX Guidance:** [CISA SBOM Overview](https://www.cisa.gov/topics/information-communications-technology-supply-chain-security/sbom) · [CISA VEX Use Cases Document (PDF)](https://www.cisa.gov/sites/default/files/publications/VEX_Use_Cases_Document_508c.pdf)
