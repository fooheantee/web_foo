---
title: "Jump Server Bypass: Recording Sessions That Never Hit PAM"
pubDate: 2026-10-29T11:47:45.747Z
fmContentType: blog
description: How to capture video and keystroke session recordings on physical or direct-RDP servers when admins bypass traditional PAM jump gateways.
slug: "jump-server-bypass"
tags:
    - Cybersecurity
    - Delinea
    - PAM
    - Privileged Access Management
    - IAM
keywords:
    - Cybersecurity
    - Delinea
    - IAM
    - Privileged Access Management
    - PAM
---

Here's an interesting PAM challenge that sent me down a rabbit hole a couple of years ago.

## The task

Secure an "almost air-gapped" physical server sitting in the server room.
The catch

If an admin logs directly into the physical console — or manages to RDP directly into the server, completely bypassing the PAM jump gateway — I still needed to record the video, capture the keystrokes, and securely upload the video, keystrokes, and session to the PAM system the moment the session ended.

Standard asks. Except most PAM platforms weren't built for it.

They rely on proxying the connection. If you bypass the proxy, you bypass the recording.
What we evaluated

This kicked off a massive research and POC phase evaluating the heavyweights: CyberArk (now Idira), BeyondTrust, Netwrix Privilege Secure, Delinea (formerly Thycotic), and others.

## The fix

The fix came from an unexpected place: Delinea's Advanced Session-Recording Agent (ASRA).

Instead of relying on a network gateway, ASRA sits directly on the endpoint. With Record All Sessions enabled, the moment a user logs onto the machine, the agent initiates local session and keystroke recording. Once the session drops, it automatically ships the recording back to Secret Server.

Voila. No gateway required, and no blind spots for direct console access.
Have you seen this gap?

Has anyone else had to tackle the "direct physical access" or "Jump Server Bypass" loophole in their PAM deployments? What did you use?

## Check out how it work here:
[Installing the Advanced Session-Recording Agent](https://docs.delinea.com/online-help/secret-server/session-recording/installing-the-asra/index.htm)