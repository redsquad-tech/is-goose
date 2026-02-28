const backendUrl = process.env.AGENT_SERVER_URL ?? "http://127.0.0.1:3001";

const run = async (): Promise<void> => {
  const response = await fetch(`${backendUrl}/status`);
  if (!response.ok) {
    throw new Error(`status check failed: ${response.status}`);
  }
  process.stdout.write(`desktop-probe:ok ${backendUrl}\n`);
};

void run()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`desktop-probe:error ${String(error)}\n`);
    process.exit(1);
  });
