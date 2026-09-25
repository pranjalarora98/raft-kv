import http from "node:http";

// Plumbing: moves JSON messages between nodes over HTTP. No Raft logic here.

export type Address = { host: string; port: number };

// Starts this node's server. Every message that arrives is passed to
// onMessage(type, body), and whatever onMessage returns is sent back as the reply.
export function listen(
  port: number,
  onMessage: (type: string, body: any) => unknown | Promise<unknown>,
): http.Server {
  const server = http.createServer((req, res) => {
    const type = (req.url ?? "/").slice(1);
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", async () => {
      try {
        const reply = await onMessage(type, raw ? JSON.parse(raw) : {});
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(reply ?? {}));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
  });
  server.listen(port);
  return server;
}

// Sends a message to another node and waits for its reply.
//
// Returns null if no reply comes back: the node is down, the network failed,
// or it took longer than timeoutMs. There is no way to tell which. A null is
// not a "no" — it is no answer at all.
//
// Keep timeoutMs well below the election countdown.
export async function send<Reply>(
  to: Address,
  type: string,
  body: unknown,
  timeoutMs = 400,
): Promise<Reply | null> {
  try {
    const res = await fetch(`http://${to.host}:${to.port}/${type}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as Reply;
  } catch {
    return null;
  }
}
