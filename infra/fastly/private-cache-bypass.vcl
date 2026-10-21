# Active on Fastly service bhEs3I9sbvxlCzr9kb0IBQ, version 2.
# Regular snippet: vcl_recv, priority 100. Not a complete VCL file.
# Cache only anonymous static asset requests.
if ((req.method != "GET" && req.method != "HEAD") ||
    req.http.Authorization || req.http.Cookie ||
    req.url.path !~ "^/assets/") {
  return(pass);
}
