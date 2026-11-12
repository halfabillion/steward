const { expect } = require("chai");
const { ethers } = require("hardhat");

const HASH_A = ethers.id("mandate-v1");
const HASH_B = ethers.id("mandate-v2");
const RESEARCH = ethers.id("research-v1");
const PROPOSAL = ethers.id("proposal-v1");

describe("StewardProposalLog", function () {
  async function deploy() {
    const [owner, agent, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("StewardProposalLog");
    const log = await Factory.deploy();
    await log.waitForDeployment();
    return { log, owner, agent, other };
  }

  it("lets the owner set a mandate and an agent propose against it", async function () {
    const { log, owner, agent } = await deploy();
    await expect(log.connect(owner).setMandate(HASH_A)).to.emit(log, "MandateSet");
    const m = await log.mandates(owner.address);
    expect(m.exists).to.equal(true);
    expect(m.mandateHash).to.equal(HASH_A);

    const tx = await log.connect(agent).propose(owner.address, HASH_A, RESEARCH, PROPOSAL);
    const rc = await tx.wait();
    const ev = rc.logs.find((l) => l.fragment && l.fragment.name === "Proposed");
    expect(ev.args.owner).to.equal(owner.address);
    expect(ev.args.mandateHash).to.equal(HASH_A);
    const id = ev.args.proposalId;

    const p = await log.proposals(id);
    expect(p.owner).to.equal(owner.address);
    expect(p.status).to.equal(1); // Proposed
    expect(await log.proposalCount()).to.equal(1n);
  });

  it("lets only the owner approve, and only once, matching the current mandate", async function () {
    const { log, owner, agent, other } = await deploy();
    await log.connect(owner).setMandate(HASH_A);
    const id = await proposeId(log, agent, owner.address, HASH_A);

    await expect(log.connect(other).approve(id)).to.be.revertedWithCustomError(log, "NotOwner");
    await expect(log.connect(owner).approve(id)).to.emit(log, "Approved");
    const p = await log.proposals(id);
    expect(p.status).to.equal(2); // Approved
    await expect(log.connect(owner).approve(id)).to.be.revertedWithCustomError(log, "NotProposed");
    await expect(log.connect(owner).reject(id)).to.be.revertedWithCustomError(log, "NotProposed");
  });

  it("lets the owner reject a pending proposal", async function () {
    const { log, owner, agent } = await deploy();
    await log.connect(owner).setMandate(HASH_A);
    const id = await proposeId(log, agent, owner.address, HASH_A);
    await expect(log.connect(owner).reject(id)).to.emit(log, "Rejected");
    expect((await log.proposals(id)).status).to.equal(3);
  });

  it("rejects a proposal that does not match the owner's mandate", async function () {
    const { log, owner, agent } = await deploy();
    await log.connect(owner).setMandate(HASH_A);
    await expect(
      log.connect(agent).propose(owner.address, HASH_B, RESEARCH, PROPOSAL),
    ).to.be.revertedWithCustomError(log, "MandateMismatch");
  });

  it("rejects propose before a mandate is set, and empty hashes", async function () {
    const { log, owner, agent } = await deploy();
    await expect(
      log.connect(agent).propose(owner.address, HASH_A, RESEARCH, PROPOSAL),
    ).to.be.revertedWithCustomError(log, "NoMandate");
    await expect(log.connect(owner).setMandate(ethers.ZeroHash)).to.be.revertedWithCustomError(
      log,
      "EmptyHash",
    );
  });

  it("is intended for a local chain tagged as Base Sepolia's id (84532), not a live deploy", async function () {
    const { log } = await deploy();
    const net = await ethers.provider.getNetwork();
    expect(net.chainId).to.equal(84532n);
    expect(await log.getAddress()).to.match(/^0x[0-9a-fA-F]{40}$/);
  });
});

async function proposeId(log, agent, owner, mandateHash) {
  const tx = await log.connect(agent).propose(owner, mandateHash, RESEARCH, PROPOSAL);
  const rc = await tx.wait();
  const ev = rc.logs.find((l) => l.fragment && l.fragment.name === "Proposed");
  return ev.args.proposalId;
}

