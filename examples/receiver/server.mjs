import http from 'node:http';

const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  console.log(
    JSON.stringify(
      {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body
      },
      null,
      2
    )
  );

  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ ok: true }));
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Example receiver listening on 3000');
});
