import http.server
import socketserver
import os

PORT = 3000
os.chdir('/Users/aurelioocampocortez/Documents/Clade Code/App Birria')

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({'.html': 'text/html'})

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
