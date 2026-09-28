# ML pipeline

Single-dataset pipeline (production model `aegis-wm-1.1.0`, CIC-IDS2017): see the main
README, section 15.

## Multi-dataset pipeline (portable model `aegis-portable-1.0.0`)

Raw data goes in `data/raw_ext/` (gitignored, ≈5 GB).

```bash
mkdir -p data/raw_ext/{unsw,ctu13,cic2018,darpa2000}

# UNSW-NB15 raw Argus+Bro records (both captures, with IPs and timestamps)
curl -L -o data/raw_ext/unsw/raw_data.parquet \
  https://huggingface.co/datasets/research-simulation26/unsw-nb15-parquet/resolve/main/raw_data.parquet

# CTU-13 bidirectional NetFlow with labels; scenarios 43 45 46 47 48 51 52 53 are used
for n in 43 45 46 47 48 51 52 53; do
  u=https://mcfp.felk.cvut.cz/publicDatasets/CTU-Malware-Capture-Botnet-$n/detailed-bidirectional-flow-labels/
  f=$(curl -s $u | grep -oE 'href="[^"]+\.binetflow"' | head -1 | cut -d'"' -f2)
  curl -L -o data/raw_ext/ctu13/ctu$n.binetflow "$u$f"
done

# CSE-CIC-IDS2018, 20-Feb-2018 only (the only day whose CSV keeps IPs), ≈4 GB
curl -L -C - -o data/raw_ext/cic2018/Tuesday-20-02-2018.csv \
  https://huggingface.co/datasets/c01dsnap/CIC-IDS2018/resolve/main/Thuesday-20-02-2018_TrafficForML_CICFlowMeter.csv

# DARPA 2000 LLDOS 1.0: inside-sensor PCAP + the five phase label files
B=https://archive.ll.mit.edu/ideval/data/2000/LLS_DDOS_1.0/data_and_labeling/tcpdump_inside
curl -L -o data/raw_ext/darpa2000/inside.dump.gz $B/LLS_DDOS_1.0-inside.dump.gz
for i in 1 2 3 4 5; do curl -L -o data/raw_ext/darpa2000/inside-phase-$i.xml $B/mid-level-phase-$i.xml; done

python ml/prepare_multi.py          # -> data/processed/windows_multi.parquet (+ windows_cicfull_ext.parquet)
python ml/evaluate_multi.py         # E1-E4 -> models/aegis-wm-1.1.0/metrics_multi.json, exports aegis-portable-1.0.0
python ml/evaluate_transfer.py      # E5 zero-shot transfer -> metrics_multi.json["E5_transfer"]
cp data/processed/windows_multi_meta.json models/aegis-portable-1.0.0/datasets.json
python presentation/build_deck.py   # SIH deck (local only, not in git)
```

DARPA 2000 flows are built from the raw PCAP by the same pure-Python flow builder the
API uses for uploads (`backend/aegis/ingestion/pcap.py`). Phase alerts in the IDMEF XML
are local time (EST) and are shifted +5 h to UTC to match the capture.

## Experiments

| id | question | protocol |
|----|----------|----------|
| E1 | how good is a model trained on one dataset? | 5-fold blocked CV inside each of CIC-IDS2017, UNSW-NB15, CTU-13 |
| E2 | does one joint model beat single-dataset models? | same folds, one model trained on all three |
| E3 | does it transfer to a network it has never seen? | leave-one-dataset-out |
| E4 | case study on a real multi-stage kill chain | joint model on DARPA 2000 LLDOS |
| E5 | do the *shipped* models transfer? can unsupervised self-calibration fix it? | portable and CIC models on CIC-IDS2018 and DARPA 2000, with and without per-network standardisation |

Datasets reviewed and **not** used: CICIoT2023 (no timestamps or IPs, so no per-host
sequences), LANL (access-restricted and mainly authentication logs), CAPEC and CVE/NVD
(no traffic; candidates for alert enrichment). MITRE ATT&CK is used only as the
stage taxonomy.
