// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StewardProposalLog
/// @notice Mandate + proposal approval log intended for Base Sepolia (chain id 84532).
/// @dev This spike compiles and unit-tests the contract locally only. It is not
///      deployed. ERC-8021 Builder Codes are an app-layer calldata suffix on the
///      outgoing transaction; they are not encoded in this contract.
///
///      Anyone may post a proposal for an owner. Only the owner may set a
///      mandate, approve, or reject. Approving never moves funds.
contract StewardProposalLog {
    enum Status {
        None,
        Proposed,
        Approved,
        Rejected
    }

    struct Mandate {
        bytes32 mandateHash;
        uint64 updatedAt;
        bool exists;
    }

    struct Proposal {
        address owner;
        bytes32 mandateHash;
        bytes32 researchHash;
        bytes32 proposalHash;
        uint64 proposedAt;
        Status status;
    }

    mapping(address => Mandate) public mandates;
    mapping(bytes32 => Proposal) public proposals;
    uint256 public proposalCount;

    event MandateSet(address indexed owner, bytes32 mandateHash, uint64 updatedAt);
    event Proposed(
        bytes32 indexed proposalId,
        address indexed owner,
        bytes32 mandateHash,
        bytes32 researchHash,
        bytes32 proposalHash
    );
    event Approved(bytes32 indexed proposalId, address indexed owner, uint64 at);
    event Rejected(bytes32 indexed proposalId, address indexed owner, uint64 at);

    error EmptyHash();
    error UnknownProposal();
    error NotOwner();
    error MandateMismatch();
    error NotProposed();
    error NoMandate();

    /// @notice Store a hash of the owner's off-chain mandate JSON.
    function setMandate(bytes32 mandateHash) external {
        if (mandateHash == bytes32(0)) revert EmptyHash();
        uint64 ts = uint64(block.timestamp);
        mandates[msg.sender] = Mandate({mandateHash: mandateHash, updatedAt: ts, exists: true});
        emit MandateSet(msg.sender, mandateHash, ts);
    }

    /// @notice Post a proposal against the owner's current mandate.
    /// @return proposalId keccak256(owner, mandate, research, proposal, nonce)
    function propose(
        address owner,
        bytes32 mandateHash,
        bytes32 researchHash,
        bytes32 proposalHash
    ) external returns (bytes32 proposalId) {
        if (owner == address(0)) revert NotOwner();
        if (mandateHash == bytes32(0) || researchHash == bytes32(0) || proposalHash == bytes32(0)) {
            revert EmptyHash();
        }
        Mandate memory m = mandates[owner];
        if (!m.exists) revert NoMandate();
        if (m.mandateHash != mandateHash) revert MandateMismatch();

        uint256 nonce = ++proposalCount;
        proposalId = keccak256(
            abi.encode(owner, mandateHash, researchHash, proposalHash, nonce, block.chainid)
        );
        proposals[proposalId] = Proposal({
            owner: owner,
            mandateHash: mandateHash,
            researchHash: researchHash,
            proposalHash: proposalHash,
            proposedAt: uint64(block.timestamp),
            status: Status.Proposed
        });
        emit Proposed(proposalId, owner, mandateHash, researchHash, proposalHash);
    }

    function approve(bytes32 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.status == Status.None) revert UnknownProposal();
        if (p.owner != msg.sender) revert NotOwner();
        if (p.status != Status.Proposed) revert NotProposed();
        Mandate memory m = mandates[msg.sender];
        if (!m.exists || m.mandateHash != p.mandateHash) revert MandateMismatch();
        p.status = Status.Approved;
        emit Approved(proposalId, msg.sender, uint64(block.timestamp));
    }

    function reject(bytes32 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.status == Status.None) revert UnknownProposal();
        if (p.owner != msg.sender) revert NotOwner();
        if (p.status != Status.Proposed) revert NotProposed();
        p.status = Status.Rejected;
        emit Rejected(proposalId, msg.sender, uint64(block.timestamp));
    }
}
