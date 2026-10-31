---
title: "Content Security Policy: How I Broke My Own Dark Mode"
description: How CSP blocked my Astro blog’s dark mode, what restored it, and the security trade-offs behind the fix.
slug: csp-how-i-broke
draft: false
tags:
  - cybersecurity
  - application-security
  - web-security
  - content-security-policy
  - astro
  - cloudflare
keywords:
  - cybersecurity
  - application-security
  - web-security
  - content-security-policy
  - astro
  - cloudflare
pubDate: 2026-10-30T04:33:00.003Z
fmContentType: blog
---

In my previous application security (AppSec) role, I reviewed client websites and often recommended security headers, including Content Security Policy (CSP).

Now that I manage my own website, I get to put that advice into practice.

I added CSP. My dark mode stopped working.

Turns out, writing the recommendation was the easy part. 😅

## When CSP Broke My Theme Toggle

I built my personal blog using the Astro static site generator and I started with a minimal Astro blog template.

I wanted to support both light and dark themes, so I added a theme toggle. That's the sun or the crescent moon icon on the top right.

To prevent a flash of the wrong theme, a small script reads the saved preference from local storage and applies it immediately.

In my build, this code ended up embedded directly in the generated HTML.

Everything worked locally.

After deploying the website, however, the theme toggle stopped working as expected.

I checked the code and tried several modifications, but nothing seemed to resolve the problem.

I finally opened Chrome DevTools.

The Chrome console revealed the actual problem: a Content Security Policy violation.

My CSP allowed scripts from my own website, but it did not allow inline JavaScript. The browser was doing exactly what I had instructed it to do: block the script.

The policy worked. My theme toggle did not.

## What Is Content Security Policy?

Content Security Policy (CSP) is an HTTP response header that tells the browser which sources of content are allowed on a website.

For example, a website may load JavaScript, CSS, images and fonts from different locations. CSP allows the website owner to define which sources the browser should trust.

The browser then checks these rules when it loads or executes content.

Why does this matter?

Imagine someone manages to inject malicious JavaScript into your website. A properly configured CSP can prevent the browser from executing that script, depending on the policy and how the injected content is delivered.

CSP is an additional layer of defence against attacks such as Cross-Site Scripting (XSS). It does not replace secure coding or fix the underlying vulnerability, but it can reduce the impact of certain attacks.


## The Change That Restored Dark Mode

I needed to adjust the policy so that the required scripts could execute.

This configuration restored the toggle, but it broadly permits inline JavaScript. It was a compatibility workaround, not a recommended final policy.

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
```

Let's break it down.

| Directive | What it does |
|---|---|
| `default-src 'self'` | Allows resources from the website's own origin by default when a more specific fetch directive is not defined. |
| `script-src 'self' 'unsafe-inline'` | Allows scripts from the same origin and inline JavaScript. |
| `style-src 'self' 'unsafe-inline'` | Allows stylesheets from the same origin and inline CSS. |

Adding 'unsafe-inline' to script-src restored the toggle.

It allowed the browser to execute the inline JavaScript required by my theme implementation.

However, there is a security trade-off.

### A Word of Caution

The `'unsafe-inline'` keyword is not limited to your theme script.

It allows inline scripts more broadly, including potentially malicious inline JavaScript injected into the page.

This weakens CSP's ability to protect against certain XSS attacks.

For a more restrictive policy, consider these alternatives:

- **External JavaScript:** Move the script into a separately served file, where practical. Check the generated HTML because Astro can inline small scripts during the build.
- **SHA-256 hashes:** Allow specific inline scripts based on their exact content. This suits static websites, but script changes require updated hashes.
- **Nonces:** Use a fresh, unpredictable value for each response. Include it in both the CSP header and the permitted script elements.

For a static website, hashes are often worth considering. Remember that even a small change to an inline script, including whitespace, changes its hash.

The objective is to allow only the scripts that your website needs, rather than allowing all inline scripts.

## Deploying CSP Headers

Once the policy is ready, you need to deliver it to visitors through HTTP response headers.

There are several ways to do this. Here are two approaches available with Cloudflare.

### Method 1: Cloudflare Response Header Transform Rules

You can configure security headers directly at Cloudflare's edge.

The general steps are:

1. Open the Cloudflare dashboard.
2. Select your website.
3. Navigate to **Rules → Transform Rules**.
4. Select **Response Header Transform Rules**.
5. Create a rule to set the `Content-Security-Policy` response header.
6. Enter your CSP policy as the header value.
7. Save and deploy the rule.

Cloudflare will apply the configured header to matching responses.

This approach is useful when you want to manage response headers centrally without changing your website's build files.

### Method 2: Static Hosting `_headers` File

Some static hosting providers support a special configuration file named `_headers`.

For Cloudflare Pages and Workers Static Assets, you can use this file to define custom HTTP response headers.

Create a file named `_headers` in the directory used for your deployed static assets.

For example:

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
```

The `/*` pattern applies the header to matching paths across the website.

During deployment, the hosting platform reads the file and applies the configured headers to matching static asset responses.

For Astro projects, create public/_headers. After building, confirm that the file appears in the deployed static asset directory.

**Important:** Cloudflare Workers Static Assets does not apply `_headers` rules to responses generated by your Worker code. Those responses need their headers configured in the Worker itself.

This distinction matters when a website combines static pages with dynamically generated responses.

## Checking the Deployed Policy

Adding a response header is only part of the job. You also need to check that the policy works as expected.

Security scanners can quickly identify missing HTTP security headers. One tool I used to recommend is the [MDN HTTP Observatory](https://developer.mozilla.org/en-US/observatory/).

It provides an overview of a website's security headers and other security-related configurations.

You can also inspect HTTP response headers directly using cURL.

For Windows users:

```powershell
curl.exe -sS -I -L https://example.com | findstr /I "content-security-policy"
```

For macOS and Linux:

```bash
curl -sS -I -L https://example.com | grep -i "content-security-policy"
```

If no matching header appears, investigate further rather than treating that result as a complete CSP assessment.

These checks are useful starting points, but a scanner cannot tell you whether your security policy is suitable for your website or whether it breaks existing functionality.

After deployment:

1. Inspect the HTTP response headers using cURL.
2. Open the website in your browser.
3. Check the Developer Tools console for CSP violations.
4. Test important website functions, including the theme toggle, navigation and any external resources.
5. Review the security scanner report again.

For a new or significantly changed policy, consider testing it with Content-Security-Policy-Report-Only first.

The browser reports violations of that policy without enforcing it. Any existing enforced CSP remains active.

To collect reports centrally, configure a reporting endpoint.

This allows you to identify policy violations without immediately blocking the affected resources. You can then adjust the policy before enforcing it.

## Final Thoughts

Adding CSP was easy. Making it work with my website took more care.

The browser was enforcing the policy I supplied. I had not accounted for how my theme script ran.

Restoring the toggle solved the immediate problem. Choosing which scripts to trust was the more important security decision.

At least my dark mode is working again. 😄

---

## Further Reading

- [MDN – Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP)
- [Astro – Scripts and Event Handling](https://docs.astro.build/en/guides/client-side-scripts/)
- [Cloudflare – Workers Static Assets Headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Cloudflare – Response Header Transform Rules](https://developers.cloudflare.com/rules/transform/response-header-modification/)