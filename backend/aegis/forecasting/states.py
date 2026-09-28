"""Attack-state taxonomy and dataset label mapping.

The states are *kill-chain stages*, deliberately coarser than dataset labels.
Only states that CIC-IDS2017 can actually provide evidence for are modelled.
Stages the dataset has no labelled traffic for (lateral movement, privilege
escalation, exfiltration) are NOT invented; see docs/STATE_MAPPING.md.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum


class AttackState(IntEnum):
    NORMAL = 0
    RECONNAISSANCE = 1
    CREDENTIAL_ACCESS = 2
    EXPLOITATION = 3
    COMMAND_AND_CONTROL = 4
    INFILTRATION = 5
    IMPACT = 6


STATE_NAMES: list[str] = [s.name for s in AttackState]
NUM_STATES = len(STATE_NAMES)


@dataclass(frozen=True)
class StateInfo:
    state: AttackState
    label: str
    # Policy weight used by the risk engine (0 = harmless, 1 = worst). This is a
    # documented analyst policy, not a learned quantity.
    severity: float
    # True if the state indicates the adversary has, or is actively obtaining, a
    # foothold inside the network. P(reaching any of these) is the reported
    # "compromise probability".
    compromise: bool
    mitre_tactic: str | None
    mitre_tactic_id: str | None
    description: str


STATE_INFO: dict[AttackState, StateInfo] = {
    AttackState.NORMAL: StateInfo(
        AttackState.NORMAL, "Normal", 0.0, False, None, None,
        "No labelled attack traffic in the window.",
    ),
    AttackState.RECONNAISSANCE: StateInfo(
        AttackState.RECONNAISSANCE, "Reconnaissance", 0.30, False,
        "Discovery", "TA0007",
        "Service/port discovery (CIC-IDS2017 'PortScan', nmap sweeps).",
    ),
    AttackState.CREDENTIAL_ACCESS: StateInfo(
        AttackState.CREDENTIAL_ACCESS, "Credential access", 0.55, False,
        "Credential Access", "TA0006",
        "Online password brute force (FTP/SSH-Patator, web login brute force).",
    ),
    AttackState.EXPLOITATION: StateInfo(
        AttackState.EXPLOITATION, "Exploitation", 0.75, True,
        "Initial Access", "TA0001",
        "Exploitation of a public-facing application (XSS, SQL injection, Heartbleed).",
    ),
    AttackState.COMMAND_AND_CONTROL: StateInfo(
        AttackState.COMMAND_AND_CONTROL, "Command & control", 0.85, True,
        "Command and Control", "TA0011",
        "Botnet C2 traffic from infected internal hosts (ARES botnet).",
    ),
    AttackState.INFILTRATION: StateInfo(
        AttackState.INFILTRATION, "Infiltration", 1.0, True,
        "Execution", "TA0002",
        "Internal host compromised via malicious download; attacker activity from inside.",
    ),
    AttackState.IMPACT: StateInfo(
        AttackState.IMPACT, "Impact (DoS)", 0.80, False,
        "Impact", "TA0040",
        "Service disruption: DoS Hulk/GoldenEye/slowloris/slowhttptest, DDoS LOIT.",
    ),
}

SEVERITY = [STATE_INFO[s].severity for s in AttackState]
COMPROMISE_STATES = [int(s) for s in AttackState if STATE_INFO[s].compromise]
ATTACK_STATES = [int(s) for s in AttackState if s != AttackState.NORMAL]

# CIC-IDS2017 label -> state. Keys are normalised with `normalise_label`.
CICIDS2017_LABEL_MAP: dict[str, AttackState] = {
    "benign": AttackState.NORMAL,
    "portscan": AttackState.RECONNAISSANCE,
    "ftp-patator": AttackState.CREDENTIAL_ACCESS,
    "ssh-patator": AttackState.CREDENTIAL_ACCESS,
    "web attack brute force": AttackState.CREDENTIAL_ACCESS,
    "web attack xss": AttackState.EXPLOITATION,
    "web attack sql injection": AttackState.EXPLOITATION,
    "heartbleed": AttackState.EXPLOITATION,
    "bot": AttackState.COMMAND_AND_CONTROL,
    "infiltration": AttackState.INFILTRATION,
    "dos hulk": AttackState.IMPACT,
    "dos goldeneye": AttackState.IMPACT,
    "dos slowloris": AttackState.IMPACT,
    "dos slowhttptest": AttackState.IMPACT,
    "ddos": AttackState.IMPACT,
}


def normalise_label(label: str) -> str:
    """'Web Attack \\x96 Brute Force' -> 'web attack brute force'."""
    cleaned = "".join(ch if ch.isalnum() or ch in "- " else " " for ch in str(label))
    return " ".join(cleaned.lower().split())


def map_label(label: str) -> AttackState | None:
    """Map a dataset label to a state; None if the label is unknown."""
    return CICIDS2017_LABEL_MAP.get(normalise_label(label))
