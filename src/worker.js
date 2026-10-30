export default {
  async fetch(request, env, ctx) {
    const response = await env.ASSETS.fetch(request);
    
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const nonceArray = new Uint8Array(16);
    crypto.getRandomValues(nonceArray);
    const nonce = btoa(String.fromCharCode(...nonceArray));

    const cspHeader = [
      `default-src 'self'`,
      `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `object-src 'none'`,
      `base-uri 'self'`,
    ].join("; ");

    const rewriter = new HTMLRewriter().on("script", {
      element(element) {
        element.setAttribute("nonce", nonce);
      },
    });

    const transformedResponse = rewriter.transform(response);
    const newHeaders = new Headers(transformedResponse.headers);
    newHeaders.set("Content-Security-Policy", cspHeader);

    return new Response(transformedResponse.body, {
      status: transformedResponse.status,
      statusText: transformedResponse.statusText,
      headers: newHeaders,
    });
  },
};