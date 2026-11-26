"""Read-only smart HTTP Git fixture, intended only for isolated local Kind."""
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs


class Handler(BaseHTTPRequestHandler):
    def serve_git(self):
        url = urlsplit(self.path)
        if url.path not in {"/repo.git/info/refs", "/repo.git/git-upload-pack"}:
            self.send_error(404)
            return
        if url.path.endswith("/info/refs") and parse_qs(url.query).get("service") != ["git-upload-pack"]:
            self.send_error(403)
            return
        if self.command == "POST" and url.path != "/repo.git/git-upload-pack":
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400)
            return
        if not 0 <= length <= 8 * 1024 * 1024:
            self.send_error(413)
            return
        env = dict(os.environ, GIT_PROJECT_ROOT="/git", GIT_HTTP_EXPORT_ALL="1",
                   PATH_INFO=url.path, QUERY_STRING=url.query, REQUEST_METHOD=self.command,
                   CONTENT_TYPE=self.headers.get("Content-Type", ""), CONTENT_LENGTH=str(length))
        if self.headers.get("Git-Protocol"):
            env["HTTP_GIT_PROTOCOL"] = self.headers["Git-Protocol"]
        result = subprocess.run(["git", "http-backend"], input=self.rfile.read(length), env=env, capture_output=True, timeout=30)
        headers, separator, body = result.stdout.partition(b"\r\n\r\n")
        if not separator:
            self.send_error(502)
            return
        status = 200
        outgoing = []
        for line in headers.decode("ascii").split("\r\n"):
            key, value = line.split(":", 1)
            if key.lower() == "status":
                status = int(value.strip().split(" ", 1)[0])
            else:
                outgoing.append((key, value.strip()))
        self.send_response(status)
        for key, value in outgoing:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = serve_git
    do_POST = serve_git


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
