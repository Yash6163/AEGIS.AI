# Attack-state taxonomy and dataset mapping

Source of truth: `backend/aegis/forecasting/states.py`.

| state | CIC-IDS2017 labels | ATT&CK tactic (indicative) | compromise-class | severity (policy) |
|---|---|---|---|---:|
| NORMAL | BENIGN | - | no | 0.00 |
| RECONNAISSANCE | PortScan | Discovery (TA0007) | no | 0.30 |
| CREDENTIAL_ACCESS | FTP-Patator, SSH-Patator, Web Attack - Brute Force | Credential Access (TA0006) | no | 0.55 |
| EXPLOITATION | Web Attack - XSS, Web Attack - SQL Injection, Heartbleed | Initial Access (TA0001) | yes | 0.75 |
| COMMAND_AND_CONTROL | Bot (ARES) | Command and Control (TA0011) | yes | 0.85 |
| INFILTRATION | Infiltration | Execution (TA0002) | yes | 1.00 |
| IMPACT | DoS Hulk, DoS GoldenEye, DoS slowloris, DoS Slowhttptest, DDoS | Impact (TA0040) | no | 0.80 |

## Rationale and caveats

* **Stages are coarse on purpose.** CIC-IDS2017 labels attack *tools*, not
  kill-chain stages. The mapping groups tools by the adversary objective they
  serve. ATT&CK tactic IDs are given for orientation only. The system does
  **not** identify ATT&CK techniques.
* **Heartbleed as exploitation**: it exploits a public-facing service (memory
  disclosure). Its 11 flows make it statistically negligible.
* **Infiltration**: in CIC-IDS2017 this is a workstation compromised via a
  malicious download, followed by attacker activity from inside. Only 36
  flows (6 host-minutes) are labelled, so the state is modelled but cannot be
  evaluated meaningfully.
* **Not modelled**: lateral movement, privilege escalation and data
  exfiltration. CIC-IDS2017 has no labelled traffic for them, and we do not
  invent states the data cannot support.
* **Severity and "compromise-class" are policy choices** made for the risk
  engine. They are not learned. They can be changed in `states.py` without
  retraining.
* **Window labelling rule**: a host-minute takes the attack state with the most
  labelled flows touching the host, provided it has at least 2 flows.
  Otherwise the host-minute is NORMAL. This suppresses isolated mislabelled flows.
