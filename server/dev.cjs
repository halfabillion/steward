"use strict";

/**
 * One process: API + Vite + a proposal log.
 * Default: in-process Hardhat (chain id 84532). Never points at a public
 * chain unless STEWARD_NETWORK=base-sepolia, in which case writes go to the
 * existing StewardProposalLog on Base Sepolia after an in-app confirmation,
 * a chain-id 84532 check, and a gas estimate. Never logs private keys.
 */
const path = require("path");
const express = require("express");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);

const hre = require("hardhat");
const {
  defaultMandate,
  normaliseMandate,
  usdOrRawPositions,
  takeSnapshot,
  publicRun,
  runOnce,
  decide,
  readLog,
  sendOnchain,
} = require("./helpers.cjs");
const { startSepoliaLive } = require("./sepoliaLive.cjs");

const LOCAL_CHAIN_ID = 84532n;
const PORT = Number(process.env.STEWARD_PORT || 5173);
const HOST = "127.0.0.1";

async function main() {
  const { resolveNetwork, attachTxUrl, blockscoutAddressUrl, redactSecrets } = await import("../src/networkMode.js");
  const network = resolveNetwork(process.env);

  let owner, agent, log, contractAddress, chainId, sendTx, sessionFromBlock, liveBalance;

  await hre.run("compile");

  if (network.live) {
    const live = await startSepoliaLive(network);
    owner = live.wallet;
    agent = live.wallet; // propose is permissionless; the known owner signs every write
    log = live.contract;
    contractAddress = live.contractAddress;
    chainId = BigInt(live.chainId);
    sendTx = live.sendTx;
    sessionFromBlock = live.sessionFromBlock;
    if (process.env.STEWARD_LOG_FROM_BLOCK) {
      const n = Number(process.env.STEWARD_LOG_FROM_BLOCK);
      if (Number.isInteger(n) && n >= 0) sessionFromBlock = n;
    }
    liveBalance = live.balance;
  } else {
    if (hre.network.name !== "hardhat") {
      throw new Error(`Refusing to start on network "${hre.network.name}". Local Hardhat only.`);
    }
    const [localOwner, localAgent] = await hre.ethers.getSigners();
    const net = await hre.ethers.provider.getNetwork();
    if (net.chainId !== LOCAL_CHAIN_ID) {
      throw new Error(`Refusing to start: expected chainId ${LOCAL_CHAIN_ID}, got ${net.chainId}`);
    }
    const Factory = await hre.ethers.getContractFactory("StewardProposalLog");
    const deployed = await Factory.deploy();
    await deployed.waitForDeployment();
    owner = localOwner;
    agent = localAgent;
    log = deployed;
    contractAddress = await deployed.getAddress();
    chainId = net.chainId;
    sendTx = null;
    sessionFromBlock = 0;
    liveBalance = null;
  }

  const { snapshotUniverse: snapshotUniverseRaw } = await import("../src/data/snapshot.js");
  // Live demo: attach the read-only DEX premium (DexScreener public API, no key).
  // Set STEWARD_DEX=0 to turn it off. It is a flag only and never blocks a trade.
  const DEX_ON = process.env.STEWARD_DEX !== "0";
  const snapshotUniverse = (symbols, opts = {}) =>
    snapshotUniverseRaw(symbols, { dexMarket: DEX_ON, ...opts });
  const { DEMO_UNIVERSE, NAV_SCALE } = await import("../src/constants.js");
  const { proposeRebalance } = await import("../src/engine/propose.js");
  const { explainProposal } = await import("../src/engine/explain.js");
  const { hashMandate, hashResearch, hashProposalBody } = await import("../src/engine/hash.js");
  const { applyPaper } = await import("../src/engine/paper.js");
  const { withBuilderCode, BUILDER_CODE_STATUS } = await import("../src/builderCode.js");
  const { toJsonable } = await import("../src/serialize.js");
  const { evaluateLocation, ATTESTATION_ITEMS } = await import("../src/eligibility.js");

  const state = {
    mandate: defaultMandate(DEMO_UNIVERSE, NAV_SCALE),
    mandateTx: null,
    snapshot: null,
    snapshotError: null,
    lastRun: null,
    runs: [],
    schedule: null,
  };

  const runDeps = () => ({
    snapshotUniverse,
    proposeRebalance,
    explainProposal,
    hashMandate,
    hashResearch,
    hashProposalBody,
    withBuilderCode,
    applyPaper,
    log,
    owner,
    agent,
    contractAddress,
    state,
    sendTx,
  });

  function publicSchedule() {
    const s = state.schedule;
    if (!s) return null;
    return {
      intervalSec: s.intervalSec,
      remaining: s.remaining,
      maxRuns: s.maxRuns,
      runsDone: s.maxRuns - s.remaining,
      running: Boolean(s.timer),
      nextAt: s.nextAt || null,
    };
  }

  function withTxUrl(hash) {
    return attachTxUrl(hash, network.live);
  }

  function publicStatus() {
    return {
      chainId: Number(chainId),
      network: {
        name: network.name,
        mode: network.mode,
        live: network.live,
        chainId: Number(chainId),
        label: network.label,
        explorerOrigin: network.explorerOrigin,
        contractUrl: network.live ? blockscoutAddressUrl(contractAddress) : null,
      },
      contract: contractAddress,
      owner: owner.address,
      agent: agent.address,
      sessionFromBlock: network.live ? sessionFromBlock : 0,
      builderCode: { status: BUILDER_CODE_STATUS, tagged: false },
      schedule: publicSchedule(),
    };
  }

  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, ...publicStatus() }));

  app.get("/api/eligibility", (req, res) => {
    const timeZone = String(req.query.timeZone || "");
    const countryCode = req.query.countryCode ? String(req.query.countryCode) : null;
    res.json({ ...evaluateLocation({ timeZone, countryCode }), items: ATTESTATION_ITEMS });
  });

  app.get("/api/status", (_req, res) => {
    res.json(toJsonable({
      ...publicStatus(),
      mandate: state.mandate,
      mandateTx: state.mandateTx,
      hasSnapshot: Boolean(state.snapshot),
      snapshot: state.snapshot,
      snapshotAt: state.snapshot?.at ?? null,
      snapshotError: state.snapshotError,
      lastRun: publicRun(state.lastRun),
    }));
  });

  app.get("/api/snapshot", async (_req, res) => {
    try {
      const snap = await takeSnapshot(snapshotUniverse, state.mandate);
      state.snapshot = snap;
      state.snapshotError = null;
      res.json(toJsonable({ snapshot: snap, mandate: state.mandate }));
    } catch (err) {
      state.snapshotError = String(err.message || err);
      res.status(502).json({ error: state.snapshotError });
    }
  });

  app.put("/api/mandate", async (req, res) => {
    try {
      const next = normaliseMandate(req.body, DEMO_UNIVERSE);
      if (state.snapshot) next.positions = usdOrRawPositions(next, state.snapshot);
      next.neverAutoSpend = true;
      const mandateHash = hashMandate(next);
      const data = log.interface.encodeFunctionData("setMandate", [mandateHash]);
      const tagged = withBuilderCode(data);
      const rc = await sendOnchain(runDeps(), owner, tagged.data);
      state.mandate = next;
      state.mandateTx = {
        hash: rc.hash,
        mandateHash,
        tagged: tagged.tagged,
        tagReason: tagged.reason,
        txUrl: withTxUrl(rc.hash),
      };
      res.json(toJsonable({ mandate: next, tx: state.mandateTx, status: publicStatus() }));
    } catch (err) {
      res.status(400).json({ error: redactSecrets(String(err.message || err)) });
    }
  });

  function enrichRun(result) {
    if (result?.onchain) {
      result.onchain.txUrl = withTxUrl(result.onchain.tx);
      result.onchain.decisionTxUrl = withTxUrl(result.onchain.decisionTx);
    }
    if (state.mandateTx) state.mandateTx.txUrl = withTxUrl(state.mandateTx.hash);
    return result;
  }

  app.post("/api/agent/run", async (_req, res) => {
    try {
      const result = enrichRun(await runOnce(runDeps()));
      res.json(toJsonable(result));
    } catch (err) {
      res.status(500).json({ error: redactSecrets(String(err.message || err)) });
    }
  });

  app.post("/api/agent/schedule", (req, res) => {
    if (network.live) {
      return res.status(400).json({ error: "Bounded schedules are disabled in live Base Sepolia mode so a timer cannot send testnet transactions." });
    }
    const intervalSec = Number(req.body?.intervalSec);
    const maxRuns = Number(req.body?.maxRuns);
    if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 6) {
      return res.status(400).json({ error: "maxRuns is required and must be an integer from 1 to 6." });
    }
    if (!Number.isInteger(intervalSec) || intervalSec < 60 || intervalSec > 3600) {
      return res.status(400).json({ error: "intervalSec must be an integer from 60 to 3600." });
    }
    if (state.schedule?.timer) {
      return res.status(409).json({ error: "A bounded schedule is already running. Stop it first." });
    }
    state.schedule = { intervalSec, maxRuns, remaining: maxRuns, timer: null, nextAt: null };
    const arm = (ms) => {
      state.schedule.nextAt = Date.now() + ms;
      state.schedule.timer = setTimeout(tick, ms);
    };
    const tick = async () => {
      if (!state.schedule) return;
      state.schedule.nextAt = null;
      try {
        await runOnce(runDeps());
      } catch (err) {
        console.error("scheduled run failed:", err.message);
      }
      if (!state.schedule) return;
      state.schedule.remaining -= 1;
      if (state.schedule.remaining <= 0) {
        state.schedule.timer = null;
        state.schedule.nextAt = null;
        return;
      }
      arm(state.schedule.intervalSec * 1000);
    };
    arm(intervalSec * 1000);
    res.json({ ok: true, schedule: publicStatus().schedule });
  });

  app.delete("/api/agent/schedule", (_req, res) => {
    if (state.schedule?.timer) clearTimeout(state.schedule.timer);
    state.schedule = null;
    res.json({ ok: true, schedule: null });
  });

  app.post("/api/proposals/:id/approve", async (req, res) => {
    try {
      const result = await decide("approve", req.params.id, runDeps());
      if (result.lastRun) enrichRun(result.lastRun);
      result.txUrl = withTxUrl(result.tx);
      res.json(toJsonable(result));
    } catch (err) {
      res.status(400).json({ error: redactSecrets(String(err.message || err)) });
    }
  });

  app.post("/api/proposals/:id/reject", async (req, res) => {
    try {
      const result = await decide("reject", req.params.id, runDeps());
      if (result.lastRun) enrichRun(result.lastRun);
      result.txUrl = withTxUrl(result.tx);
      res.json(toJsonable(result));
    } catch (err) {
      res.status(400).json({ error: redactSecrets(String(err.message || err)) });
    }
  });

  app.get("/api/log", async (_req, res) => {
    try {
      const entries = (await readLog(log, { fromBlock: sessionFromBlock })).map((e) => ({
        ...e,
        txUrl: withTxUrl(e.tx),
      }));
      res.json(toJsonable({ entries, ...publicStatus() }));
    } catch (err) {
      res.status(500).json({ error: redactSecrets(String(err.message || err)) });
    }
  });

  const { createServer: createVite } = await import("vite");
  const vite = await createVite({
    root: path.join(ROOT, "web"),
    configFile: path.join(ROOT, "web", "vite.config.js"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  const server = app.listen(PORT, HOST, () => {
    console.log(`Steward app        http://${HOST}:${PORT}`);
    if (network.live) {
      console.log(`Network            Base Sepolia (${chainId}) — live testnet`);
      console.log(`Proposal log       ${contractAddress}`);
      console.log(`Deployer (public)  ${owner.address}`);
      console.log(`Session from block ${sessionFromBlock}`);
      if (liveBalance != null) console.log(`Deployer balance   ${require("ethers").formatEther(liveBalance)} ETH`);
      console.log("Private key is read at runtime only and is never printed or logged.");
      console.log("Each write checks chain id 84532 and estimated gas before signing.");
    } else {
      console.log(`Local chain id     ${chainId} (${hre.network.name}, in-process)`);
      console.log(`Proposal log       ${contractAddress}`);
      console.log(`Local owner        ${owner.address}`);
      console.log(`Local agent        ${agent.address}`);
      console.log("No private keys are written or printed. Not deployed to any public chain.");
    }
  });

  const shutdown = () => {
    if (state.schedule?.timer) clearTimeout(state.schedule.timer);
    state.schedule = null;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (err) => {
  try {
    const { redactSecrets } = await import("../src/networkMode.js");
    console.error(redactSecrets(err && err.stack ? err.stack : err));
  } catch {
    console.error("Startup failed.");
  }
  process.exit(1);
});
