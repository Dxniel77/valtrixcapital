const pages = [
  {
    network: "POLYGON",
    url: "https://polygonscan.com/tokentxns?contractaddress=0xc2132D05D31c914a87C6611C10748AEb04B58e8F&p=1",
  },
  {
    network: "POLYGON",
    url: "https://polygonscan.com/txs?a=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174&p=1",
  },
];

async function scrapeTxs(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const t = await r.text();
  const re = /\/tx\/(0x[a-fA-F0-9]{64})/g;
  const out = [];
  let m;
  while ((m = re.exec(t)) !== null) out.push(m[1]);
  return [...new Set(out)];
}

async function verify(network, hash) {
  const base =
    network === "BSC"
      ? "https://bscscan.com/tx/"
      : "https://polygonscan.com/tx/";
  const r = await fetch(base + hash, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const t = await r.text();
  return !/Transaction Hash not found|Hash de transacci/i.test(t);
}

for (const page of pages) {
  console.log("trying", page.url);
  const txs = await scrapeTxs(page.url);
  console.log(page.network, "found", txs.length, txs.slice(0, 3));
  const verified = [];
  for (const tx of txs.slice(0, 30)) {
    if (await verify(page.network, tx)) verified.push(tx);
    if (verified.length >= 12) break;
  }
  console.log(page.network, "verified", verified.length);
  if (verified.length) console.log(verified.join("\n"));
}
